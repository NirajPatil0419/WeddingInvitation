package com.weddinginvitation;

import com.weddinginvitation.config.WeddingConfig;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Checks all local media before any generated output is replaced. */
public final class AssetValidator {
    private AssetValidator() { }

    public static List<String> validate(Path staticDirectory, WeddingConfig config) throws IOException {
        Path root = staticDirectory.toRealPath();
        validateSource(root, config.venueImage(), "venue.image");
        validateSource(root, config.introVideo(), "media.introVideo");
        validateSource(root, config.musicSource(), "media.musicSource");
        for (int i = 0; i < config.photos().size(); i++) {
            validateSource(root, config.photos().get(i).source(), "story.photos." + (i + 1) + ".source");
        }
        List<String> warnings = new ArrayList<>();
        long total = 0;
        try (var paths = Files.walk(root)) {
            for (Path file : paths.sorted().toList()) {
                if (Files.isSymbolicLink(file) || !file.toRealPath().startsWith(root)) {
                    throw new IOException("Site assets must stay inside the static directory without links: " + file);
                }
                if (!Files.isRegularFile(file)) continue;
                long size = Files.size(file);
                total += size;
                String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
                long budget = name.matches(".*\\.(mp4|webm|mov)$") ? 20L * 1024 * 1024
                        : name.matches(".*\\.(mp3|m4a|ogg|wav)$") ? 10L * 1024 * 1024 : 1024 * 1024;
                if (size > budget) warnings.add(root.relativize(file) + " is "
                        + String.format(Locale.ROOT, "%.1f MiB", size / 1048576.0) + "; consider compressing it.");
            }
        }
        if (total > 90L * 1024 * 1024) warnings.add("Static assets exceed 90 MiB; check your hosting upload budget.");
        return List.copyOf(warnings);
    }

    private static void validateSource(Path root, String source, String setting) throws IOException {
        if (source.isEmpty()) return;
        URI uri = URI.create(source);
        if (uri.isAbsolute()) return; // Remote media is deliberately not fetched during builds.
        Path file = root.resolve(uri.getPath()).normalize();
        if (!file.startsWith(root) || !Files.isRegularFile(file) || !Files.isReadable(file)
                || !file.toRealPath().startsWith(root)) {
            throw new IOException(setting + " references a missing, unreadable, or outside asset: " + source);
        }
    }
}
