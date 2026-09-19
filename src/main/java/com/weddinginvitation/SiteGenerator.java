package com.weddinginvitation;

import com.weddinginvitation.config.WeddingConfig;
import com.weddinginvitation.template.HtmlTemplate;
import com.weddinginvitation.template.InvitationFragments;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;

/** Builds static files locally; no Java server is needed by invitation guests. */
public final class SiteGenerator {
    private SiteGenerator() {
    }

    public static void main(String[] args) throws IOException {
        if (args.length > 1) {
            throw new IllegalArgumentException("Usage: SiteGenerator [project-directory]");
        }
        Path root = Path.of(args.length == 1 ? args[0] : ".").toRealPath();
        WeddingConfig config = WeddingConfig.load(root.resolve("config/wedding.properties"));
        Path resources = root.resolve("src/main/resources");
        String template = Files.readString(resources.resolve("templates/index.html"), StandardCharsets.UTF_8);
        String html = HtmlTemplate.render(template, templateValues(config), Map.of(
                "eventsHtml", InvitationFragments.events(config),
                "photosHtml", InvitationFragments.photos(config)));
        String deploymentConfig = Files.readString(root.resolve("deployment/vercel-output.json"));

        Path site = root.resolve("dist");
        Path vercelOutput = root.resolve(".vercel/output");
        // Keep Vercel's project-link metadata in .vercel/ intact between builds.
        Path vercelDirectory = root.resolve(".vercel");
        if (Files.isSymbolicLink(vercelDirectory)
                || (Files.exists(vercelDirectory) && !vercelDirectory.toRealPath().equals(vercelDirectory))) {
            throw new IOException("The .vercel directory must not be a symbolic link or junction.");
        }
        recreateDirectory(root, site);
        copyDirectory(resources.resolve("static"), site);
        Files.writeString(site.resolve("index.html"), html, StandardCharsets.UTF_8);

        recreateDirectory(root, vercelOutput);
        copyDirectory(site, vercelOutput.resolve("static"));
        Files.writeString(vercelOutput.resolve("config.json"), deploymentConfig, StandardCharsets.UTF_8);

        System.out.println("Built invitation: " + site.resolve("index.html"));
        System.out.println("Vercel prebuilt output: " + vercelOutput);
    }

    private static Map<String, String> templateValues(WeddingConfig config) {
        Locale locale = Locale.forLanguageTag(config.language());
        DateTimeFormatter dateLabel = DateTimeFormatter.ofPattern(
                "EEEE, d MMMM uuuu 'at' h:mm a (OOOO)", locale);
        return Map.ofEntries(
                Map.entry("siteTitle", config.siteTitle()),
                Map.entry("siteDescription", config.siteDescription()),
                Map.entry("language", config.language()),
                Map.entry("brideName", config.brideName()),
                Map.entry("groomName", config.groomName()),
                Map.entry("invitationMessage", config.invitationMessage()),
                Map.entry("weddingDateLabel", dateLabel.format(config.weddingDateTime())),
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
                Map.entry("monogram", initial(config.groomName()) + " & " + initial(config.brideName())),
                Map.entry("introVideo", config.introVideo()),
                Map.entry("musicSource", config.musicSource()),
                Map.entry("storySubtitle", config.storySubtitle()),
                Map.entry("venueImage", config.venueImage()),
                Map.entry("venueImageAlt", config.venueImageAlt()),
                Map.entry("coupleHashtag", config.coupleHashtag()));
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
