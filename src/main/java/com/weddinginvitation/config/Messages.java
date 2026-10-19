package com.weddinginvitation.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

/** English defaults plus optional language and region overrides, all read as UTF-8. */
public final class Messages {
    private final Map<String, String> values;
    private Messages(Map<String, String> values) { this.values = Map.copyOf(values); }

    public static Messages load(Path directory, String language) throws IOException {
        Map<String, String> values = new LinkedHashMap<>();
        read(directory.resolve("en.properties"), values);
        String base = language.split("-")[0];
        if (!base.equals("en") && Files.exists(directory.resolve(base + ".properties"))) {
            read(directory.resolve(base + ".properties"), values);
        }
        if (!language.equals(base) && Files.exists(directory.resolve(language + ".properties"))) {
            read(directory.resolve(language + ".properties"), values);
        }
        return new Messages(values);
    }

    /** Applies the interface-text keys found in an invitation variant's settings; other keys are ignored. */
    public Messages withOverrides(Path file) throws IOException {
        Map<String, String> overrides = new LinkedHashMap<>();
        read(file, overrides);
        Map<String, String> merged = new LinkedHashMap<>(values);
        overrides.forEach((key, value) -> merged.replace(key, value));
        return new Messages(merged);
    }

    private static void read(Path file, Map<String, String> values) throws IOException {
        Properties properties = new Properties();
        try (var reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) { properties.load(reader); }
        for (String key : properties.stringPropertyNames()) values.put(key, properties.getProperty(key));
    }

    public String get(String key) {
        String value = values.get(key);
        if (value == null) throw new IllegalArgumentException("Missing interface message: " + key);
        return value;
    }

    public Map<String, String> values() { return values; }
}
