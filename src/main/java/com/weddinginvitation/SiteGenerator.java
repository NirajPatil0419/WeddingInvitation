package com.weddinginvitation;

import com.weddinginvitation.config.WeddingConfig;
import com.weddinginvitation.config.Messages;
import com.weddinginvitation.template.HtmlTemplate;
import com.weddinginvitation.template.InvitationFragments;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;
import java.util.HashMap;
import java.util.HexFormat;

/** Builds static files locally; no Java server is needed by invitation guests. */
public final class SiteGenerator {
    private SiteGenerator() {
    }

    public static void main(String[] args) throws IOException {
        if (args.length > 2 || (args.length == 2 && !args[1].matches("[a-z0-9-]+"))) {
            throw new IllegalArgumentException("Usage: SiteGenerator [project-directory] [variant-name]");
        }
        Path root = Path.of(args.length >= 1 ? args[0] : ".").toRealPath();
        Path settings = root.resolve("config/wedding.properties");
        // A variant (config/variants/<name>.properties) overrides only what differs and builds into its own folder.
        Path variant = args.length == 2 ? root.resolve("config/variants/" + args[1] + ".properties") : null;
        Path outputRoot = variant == null ? root : root.resolve("build/variants/" + args[1]);
        WeddingConfig config = variant == null ? WeddingConfig.load(settings) : WeddingConfig.load(settings, variant);
        Path resources = root.resolve("src/main/resources");
        Messages messages = Messages.load(resources.resolve("messages"), config.language());
        if (variant != null) messages = messages.withOverrides(variant);
        for (String warning : AssetValidator.validate(resources.resolve("static"), config)) {
            System.err.println("Media warning: " + warning);
        }
        String template = Files.readString(resources.resolve("templates/index.html"), StandardCharsets.UTF_8);
        Map<String, String> values = new HashMap<>(templateValues(config, messages));
        values.putAll(messages.values());
        values.put("assetVersion", assetVersion(resources.resolve("static")));
        String html = HtmlTemplate.render(template, values, Map.of(
                "eventsHtml", InvitationFragments.events(config),
                "photosHtml", InvitationFragments.photos(config),
                "sharingMetadata", SharingAssets.metadata(config),
                "contactHtml", InvitationFragments.contact(config, messages),
                "browserMessages", InvitationFragments.browserMessages(messages)));
        byte[] preview = SharingAssets.preview(root, config, messages);
        String deploymentConfig = Files.readString(root.resolve("deployment/vercel-output.json"));

        Files.createDirectories(outputRoot);
        Path site = outputRoot.resolve("dist");
        Path vercelOutput = outputRoot.resolve(".vercel/output");
        // Keep Vercel's project-link metadata in .vercel/ intact between builds.
        Path vercelDirectory = outputRoot.resolve(".vercel");
        if (Files.isSymbolicLink(vercelDirectory)
                || (Files.exists(vercelDirectory) && !vercelDirectory.toRealPath().equals(vercelDirectory))) {
            throw new IOException("The .vercel directory must not be a symbolic link or junction.");
        }
        recreateDirectory(outputRoot, site);
        copyDirectory(resources.resolve("static"), site);
        Files.writeString(site.resolve("index.html"), html, StandardCharsets.UTF_8);
        Files.write(site.resolve("assets/images/invitation-preview.png"), preview);
        CalendarFiles.write(site, config);

        recreateDirectory(outputRoot, vercelOutput);
        copyDirectory(site, vercelOutput.resolve("static"));
        Files.writeString(vercelOutput.resolve("config.json"), deploymentConfig, StandardCharsets.UTF_8);

        System.out.println("Built invitation: " + site.resolve("index.html"));
        System.out.println("Vercel prebuilt output: " + vercelOutput);
        if (config.publicUrl().isEmpty()) {
            System.out.println("Set site.url when the public URL is known to enable canonical and social-preview metadata.");
        }
    }

    private static Map<String, String> templateValues(WeddingConfig config, Messages messages) {
        Locale locale = Locale.forLanguageTag(config.language());
        String dateLabel = DateTimeFormatter.ofPattern("EEEE, d MMMM uuuu", locale).format(config.weddingDateTime())
                + " " + messages.get("uiAt") + " "
                + DateTimeFormatter.ofPattern("h:mm a", locale).format(config.weddingDateTime());
        return Map.ofEntries(
                Map.entry("siteTitle", config.siteTitle()),
                Map.entry("siteDescription", config.siteDescription()),
                Map.entry("language", config.language()),
                Map.entry("brideName", config.brideName()),
                Map.entry("groomName", config.groomName()),
                Map.entry("invitationMessage", config.invitationMessage()),
                Map.entry("weddingDateLabel", dateLabel),
                Map.entry("weddingDateTime", DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(config.weddingDateTime())),
                Map.entry("venueName", config.venueName()),
                Map.entry("venueAddress", config.venueAddress()),
                Map.entry("venueMapUrl", config.venueMapUrl().toASCIIString()),
                Map.entry("footerMessage", config.footerMessage()),
                Map.entry("groomParents", config.groomParents()),
                Map.entry("brideParents", config.brideParents()),
                Map.entry("blessingText", config.blessingText()),
                Map.entry("weddingDay", DateTimeFormatter.ofPattern("dd", locale).format(config.weddingDateTime())),
                Map.entry("weddingMonth", DateTimeFormatter.ofPattern("MMMM", locale).format(config.weddingDateTime())),
                Map.entry("weddingYear", DateTimeFormatter.ofPattern("uuuu", locale).format(config.weddingDateTime())),
                Map.entry("weddingWeekday", DateTimeFormatter.ofPattern("EEEE", locale).format(config.weddingDateTime())),
                Map.entry("weddingTime", DateTimeFormatter.ofPattern("h:mm a", locale).format(config.weddingDateTime())),
                Map.entry("weddingDateShort", DateTimeFormatter.ofPattern("dd.MM.uuuu", locale).format(config.weddingDateTime())),
                Map.entry("groomInitial", initial(config.groomName())),
                Map.entry("brideInitial", initial(config.brideName())),
                Map.entry("introVideo", config.introVideo()),
                Map.entry("musicSource", config.musicSource()),
                Map.entry("storySubtitle", config.storySubtitle()),
                Map.entry("venueImage", config.venueImage()),
                Map.entry("venueImageAlt", config.venueImageAlt()),
                Map.entry("familySignature", config.familySignature()));
    }

    /** Changes whenever a stylesheet or script changes, so browsers fetch the new file instead of a cached one. */
    private static String assetVersion(Path staticDirectory) throws IOException {
        try (var paths = Files.walk(staticDirectory)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (Path path : paths.filter(Files::isRegularFile)
                    .filter(path -> path.startsWith(staticDirectory.resolve("css"))
                            || path.startsWith(staticDirectory.resolve("js")))
                    .sorted().toList()) {
                digest.update(staticDirectory.relativize(path).toString().getBytes(StandardCharsets.UTF_8));
                digest.update(Files.readAllBytes(path));
            }
            return HexFormat.of().formatHex(digest.digest(), 0, 5);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by every Java runtime.", exception);
        }
    }

    private static String initial(String name) {
        return new String(Character.toChars(name.codePointAt(0))).toUpperCase(Locale.ROOT);
    }

    private static void recreateDirectory(Path root, Path directory) throws IOException {
        Path target = directory.toAbsolutePath().normalize();
        // Only these two generated directories may be cleared; never the project root.
        if ((!target.equals(root.resolve("dist")) && !target.equals(root.resolve(".vercel/output")))
                || Files.isSymbolicLink(target)
                || (Files.exists(target) && !target.toRealPath().equals(target))) {
            throw new IOException("Refusing to replace unexpected output directory: " + target);
        }
        if (Files.exists(target)) {
            try (var paths = Files.walk(target)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                    Files.delete(path);
                }
            }
        }
        Files.createDirectories(target);
    }

    private static void copyDirectory(Path source, Path destination) throws IOException {
        try (var paths = Files.walk(source)) {
            for (Path path : paths.toList()) {
                if (path.getFileName().toString().equals(".gitkeep")) {
                    continue;
                }
                if (Files.isSymbolicLink(path)) {
                    throw new IOException("Use regular files for site assets: " + path);
                }
                Path target = destination.resolve(source.relativize(path));
                if (Files.isDirectory(path)) {
                    Files.createDirectories(target);
                } else {
                    Files.copy(path, target, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
    }
}
