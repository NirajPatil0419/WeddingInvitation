import com.weddinginvitation.AssetValidator;
import com.weddinginvitation.CalendarFiles;
import com.weddinginvitation.SiteGenerator;
import com.weddinginvitation.config.Messages;
import com.weddinginvitation.config.WeddingConfig;
import com.weddinginvitation.template.HtmlTemplate;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.Properties;
import javax.imageio.ImageIO;

/** Dependency-free checks of build contracts and failure behavior. */
public class GeneratorChecks {
    private static int checks;
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args[0]).toRealPath();
        Path fixture = Files.createTempDirectory(root.resolve("build"), "generator-check-");
        copy(root.resolve("src/main/resources"), fixture.resolve("src/main/resources"));
        copy(root.resolve("tools/font-sources"), fixture.resolve("tools/font-sources"));
        copy(root.resolve("deployment"), fixture.resolve("deployment"));
        Files.createDirectories(fixture.resolve("config"));
        Path settings = fixture.resolve("config/wedding.properties");
        Properties properties = new Properties();
        try (var reader = Files.newBufferedReader(root.resolve("config/wedding.properties"))) { properties.load(reader); }
        properties.setProperty("site.url", "");
        properties.setProperty("contact.url", "");
        properties.setProperty("wedding.dateTime", "2026-11-25T12:45:00+05:30");
        save(settings, properties);

        String escaped = HtmlTemplate.render("{{name}}", Map.of("name", "<>&\"'{{name}}"));
        check(escaped.equals("&lt;&gt;&amp;&quot;&#39;{{name}}"), "HTML escaping and single-pass substitution");
        SiteGenerator.main(new String[]{fixture.toString()});
        String html = Files.readString(fixture.resolve("dist/index.html"));
        check(!html.contains("{{") && !html.contains("rel=\"canonical\""), "Local build has resolved placeholders and no invented canonical URL");
        check(!html.contains("contact-link"), "Unconfigured contact link stays hidden");
        Files.createDirectories(fixture.resolve("config/variants"));
        Files.writeString(fixture.resolve("config/variants/only-wedding.properties"),
                "events.count=1\nevents.1.title=Wedding\nuiDaysOf=Day of\n");
        SiteGenerator.main(new String[]{fixture.toString(), "only-wedding"});
        String variantHtml = Files.readString(fixture.resolve("build/variants/only-wedding/dist/index.html"));
        check(variantHtml.contains("Day of <em>") && !variantHtml.contains("Haldi")
                && variantHtml.split("class=\"event-card").length == 2, "Variant overrides events and interface text");
        check(html.equals(Files.readString(fixture.resolve("dist/index.html"))), "Variant build leaves the main invitation untouched");
        try {
            SiteGenerator.main(new String[]{fixture.toString(), "../escape"});
            throw new AssertionError("Variant names cannot leave the project");
        } catch (IllegalArgumentException expected) {
            check(expected.getMessage().contains("Usage"), "Variant names cannot leave the project");
        }
        var preview = ImageIO.read(fixture.resolve("dist/assets/images/invitation-preview.png").toFile());
        check(preview.getWidth() == 1200 && preview.getHeight() == 630, "Generated social preview dimensions");
        try (var files = Files.walk(fixture.resolve("dist"))) {
            check(files.noneMatch(file -> file.toString().endsWith(".ttf") || file.toString().endsWith(".woff")), "Only optimized font formats are published");
        }
        String calendar = Files.readString(fixture.resolve("dist/calendar/wedding.ics"));
        check(calendar.contains("DTSTART:20261125T071500Z\r\n"), "Calendar preserves the IST instant in UTC");
        String longCalendar = CalendarFiles.render("Wedding, family; " + "\u0928\u092e\u0938\u094d\u0924\u0947".repeat(30),
                ZonedDateTime.parse("2026-11-25T12:45:00+05:30"), "Venue\\City", "First\r\nSecond", "stable", "");
        check(longCalendar.contains("Wedding\\, family\\;") && longCalendar.contains("First\\nSecond"), "Calendar text escaping");
        for (String line : longCalendar.split("\r\n")) check(line.getBytes(StandardCharsets.UTF_8).length <= 75, "Calendar folding stays within 75 UTF-8 octets");
        String unfolded = longCalendar.replace("\r\n ", "");
        check(unfolded.contains("\u0928\u092e\u0938\u094d\u0924\u0947".repeat(30)), "Calendar folding preserves Unicode");
        check(!calendar.contains("DTEND:"), "Calendar does not invent an event end time");

        properties.setProperty("site.url", "https://example.test/invitation");
        properties.setProperty("contact.url", "mailto:family@example.test");
        properties.setProperty("couple.groom", "Niraj <script>alert(1)</script>");
        save(settings, properties);
        SiteGenerator.main(new String[]{fixture.toString()});
        html = Files.readString(fixture.resolve("dist/index.html"));
        check(html.contains("https://example.test/invitation/assets/images/invitation-preview.png"), "Social image uses an absolute URL under the configured root");
        check(html.contains("rel=\"canonical\" href=\"https://example.test/invitation/\""), "Canonical URL is normalized");
        check(html.contains("href=\"mailto:family@example.test\""), "Configured contact link is rendered");
        check(html.contains("Niraj &lt;script&gt;") && !html.contains("<script>alert(1)"), "Configured names stay escaped in generated HTML");
        String originalImage = properties.getProperty("venue.image");
        properties.setProperty("venue.image", "assets/images/missing-photo.webp");
        save(settings, properties);
        expectFailure(() -> SiteGenerator.main(new String[]{fixture.toString()}), "venue.image", "Missing media fails with its setting name");
        check(html.equals(Files.readString(fixture.resolve("dist/index.html"))), "Failed media validation preserves the previous build");
        properties.setProperty("venue.image", "assets/%2e%2e/outside.png");
        save(settings, properties);
        expectFailure(() -> WeddingConfig.load(settings), "venue.image", "Encoded traversal is rejected");
        properties.setProperty("venue.image", originalImage);
        properties.setProperty("site.url", "https://example.test/?secret=value");
        save(settings, properties);
        expectFailure(() -> WeddingConfig.load(settings), "site.url", "Public URL rejects query strings");
        properties.setProperty("site.url", "");
        properties.setProperty("contact.url", "javascript:alert(1)");
        save(settings, properties);
        expectFailure(() -> WeddingConfig.load(settings), "contact.url", "Contact links reject executable schemes");
        properties.setProperty("contact.url", "tel:+911234567890");
        save(settings, properties);
        WeddingConfig config = WeddingConfig.load(settings);
        check(config.contactUrl().equals("tel:+911234567890"), "Telephone contact is supported");
        Files.write(fixture.resolve("src/main/resources/static/assets/images/large.jpg"), new byte[2 * 1024 * 1024]);
        check(AssetValidator.validate(fixture.resolve("src/main/resources/static"), config).stream()
                .anyMatch(warning -> warning.contains("large.jpg")), "Oversized media produces an actionable warning");
        Path messages = fixture.resolve("src/main/resources/messages");
        Files.writeString(messages.resolve("fr.properties"), "uiContact=Contactez la famille\njsMusicOff=Musique arr\u00eat\u00e9e\n");
        Messages translated = Messages.load(messages, "fr-FR");
        check(translated.get("uiContact").equals("Contactez la famille") && translated.get("jsMusicOff").contains("\u00ea"), "UTF-8 locale overrides load");
        check(translated.get("uiDirections").equals(Messages.load(messages, "en").get("uiDirections")), "Missing translations inherit English defaults");
        System.out.println("Generator checks passed: " + checks);
    }

    private static void save(Path path, Properties properties) throws IOException {
        try (var writer = Files.newBufferedWriter(path)) { properties.store(writer, "Test fixture"); }
    }
    private static void copy(Path source, Path target) throws IOException {
        try (var files = Files.walk(source)) {
            for (Path file : files.toList()) {
                Path destination = target.resolve(source.relativize(file));
                if (Files.isDirectory(file)) Files.createDirectories(destination);
                else Files.copy(file, destination);
            }
        }
    }
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
        checks++;
    }
    private interface CheckedAction { void run() throws Exception; }
    private static void expectFailure(CheckedAction action, String setting, String message) throws Exception {
        try { action.run(); }
        catch (IOException exception) { check(exception.getMessage().contains(setting), message); return; }
        throw new AssertionError(message);
    }
}
