package com.weddinginvitation;

import com.weddinginvitation.config.Messages;
import com.weddinginvitation.config.WeddingConfig;
import com.weddinginvitation.template.HtmlTemplate;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontFormatException;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;
import javax.imageio.ImageIO;

/** A text-based sharing card generated from the same configuration as the invitation. */
public final class SharingAssets {
    private SharingAssets() { }

    public static HtmlTemplate.Fragment metadata(WeddingConfig config) {
        if (config.publicUrl().isEmpty()) return HtmlTemplate.fragment("", Map.of());
        return HtmlTemplate.fragment("""
                <link rel="canonical" href="{{url}}">
                <meta property="og:url" content="{{url}}">
                <meta property="og:image" content="{{image}}">
                <meta property="og:image:type" content="image/png">
                <meta property="og:image:width" content="1200">
                <meta property="og:image:height" content="630">
                <meta property="og:image:alt" content="{{title}}">
                <meta name="twitter:card" content="summary_large_image">
                """, Map.of("url", config.publicUrl(), "image", URI.create(config.publicUrl())
                        .resolve("assets/images/invitation-preview.png").toASCIIString(), "title", config.siteTitle()));
    }

    public static byte[] preview(Path project, WeddingConfig config, Messages messages) throws IOException {
        Font serif = font(project.resolve("tools/font-sources/CormorantGaramond-Variable.ttf"));
        BufferedImage image = new BufferedImage(1200, 630, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setColor(Color.decode("#a1aa91")); g.fillRect(0, 0, 1200, 630);
            g.setColor(Color.decode("#5b4828"));
            g.drawRoundRect(30, 30, 1140, 570, 24, 24);
            g.drawRoundRect(40, 40, 1120, 550, 20, 20);
            g.drawLine(440, 155, 760, 155); g.drawLine(440, 410, 760, 410);
            g.setColor(Color.decode("#2f402d"));
            centered(g, messages.get("uiPreviewHeading"), new Font(Font.SERIF, Font.PLAIN, 30), 118, 980);
            g.setColor(Color.decode("#29412e"));
            centered(g, config.groomName() + " & " + config.brideName(), serif.deriveFont(110f), 295, 970);
            Locale locale = Locale.forLanguageTag(config.language());
            g.setColor(Color.decode("#27392a"));
            centered(g, DateTimeFormatter.ofPattern("d MMMM uuuu", locale).format(config.weddingDateTime()),
                    serif.deriveFont(46f), 375, 980);
            centered(g, DateTimeFormatter.ofPattern("h:mm a", locale).format(config.weddingDateTime()),
                    serif.deriveFont(29f), 467, 980);
            centered(g, config.venueName(), serif.deriveFont(34f), 528, 980);
        } finally { g.dispose(); }
        var bytes = new java.io.ByteArrayOutputStream();
        if (!ImageIO.write(image, "png", bytes)) throw new IOException("PNG image writer is unavailable.");
        return bytes.toByteArray();
    }

    private static Font font(Path file) throws IOException {
        try (var input = Files.newInputStream(file)) { return Font.createFont(Font.TRUETYPE_FONT, input); }
        catch (FontFormatException exception) { throw new IOException("Invalid preview font: " + file, exception); }
    }

    private static void centered(Graphics2D g, String text, Font font, int baseline, int maxWidth) {
        g.setFont(font.canDisplayUpTo(text) == -1 ? font : new Font(Font.SERIF, Font.PLAIN, font.getSize()));
        while (g.getFontMetrics().stringWidth(text) > maxWidth && g.getFont().getSize() > 12) {
            g.setFont(g.getFont().deriveFont(g.getFont().getSize2D() - 1));
        }
        g.drawString(text, (1200 - g.getFontMetrics().stringWidth(text)) / 2, baseline);
    }
}
