package com.weddinginvitation.config;

import java.io.IOException;
import java.io.Reader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.IllformedLocaleException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Properties;

/** All editable invitation details, loaded from a UTF-8 properties file. */
public record WeddingConfig(
        String siteTitle,
        String siteDescription,
        String language,
        String publicUrl,
        String contactUrl,
        String brideName,
        String groomName,
        String invitationMessage,
        ZonedDateTime weddingDateTime,
        String venueName,
        String venueAddress,
        URI venueMapUrl,
        String footerMessage,
        String groomParents,
        String brideParents,
        String blessingText,
        String introVideo,
        String musicSource,
        String storySubtitle,
        String venueImage,
        String venueImageAlt,
        String familySignature,
        List<Event> events,
        List<StoryPhoto> photos) {

    public WeddingConfig {
        events = List.copyOf(events);
        photos = List.copyOf(photos);
    }

    public enum EventIcon { HALDI, MEHENDI, SANGEET, VIVAH, WEDDING }

    public record Event(String title, ZonedDateTime dateTime, String description,
                        URI mapUrl, EventIcon icon) { }

    public record StoryPhoto(String source, String alt, String title, String caption) { }

    /** Loads the invitation details and reports missing or invalid values clearly. Later files override earlier ones. */
    public static WeddingConfig load(Path... paths) throws IOException {
        Properties properties = new Properties();
        for (Path path : paths) {
            try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
                properties.load(reader);
            }
        }

        String bride = required(properties, "couple.bride");
        String groom = required(properties, "couple.groom");
        ZonedDateTime dateTime = dateTime(required(properties, "wedding.dateTime"), "wedding.dateTime");
        URI mapUrl = mapUrl(required(properties, "venue.mapsUrl"), "venue.mapsUrl");

        return new WeddingConfig(
                optional(properties, "site.title", groom + " & " + bride + " | Wedding Invitation"),
                required(properties, "site.description"),
                language(required(properties, "site.language")),
                publicUrl(optional(properties, "site.url", "")),
                contactUrl(optional(properties, "contact.url", "")),
                bride,
                groom,
                required(properties, "wedding.message"),
                dateTime,
                required(properties, "venue.name"),
                required(properties, "venue.address"),
                mapUrl,
                required(properties, "family.message"),
                optional(properties, "couple.groomParents", ""),
                optional(properties, "couple.brideParents", ""),
                optional(properties, "wedding.blessing", "With the blessings of our families"),
                assetSource(optional(properties, "media.introVideo", ""), "media.introVideo", true),
                assetSource(optional(properties, "media.musicSource", ""), "media.musicSource", true),
                optional(properties, "story.subtitle", "A few little moments, a lifetime of memories."),
                assetSource(optional(properties, "venue.image", "assets/images/venue.svg"), "venue.image", false),
                optional(properties, "venue.imageAlt", "Illustration of a wedding venue"),
                required(properties, "family.signature"),
                events(properties, dateTime, mapUrl),
                photos(properties));
    }

    private static String optional(Properties properties, String key, String fallback) {
        String value = properties.getProperty(key);
        return value == null || value.isBlank() ? fallback : value.strip();
    }

    private static List<Event> events(Properties properties, ZonedDateTime weddingDate, URI weddingMap) throws IOException {
        int count = count(properties, "events.count", 1);
        List<Event> events = new ArrayList<>();
        for (int index = 1; index <= count; index++) {
            String prefix = "events." + index + ".";
            String title = index == 1
                    ? optional(properties, prefix + "title", "Wedding ceremony")
                    : required(properties, prefix + "title");
            String dateValue = optional(properties, prefix + "dateTime", "wedding");
            ZonedDateTime eventDate = dateValue.equals("wedding")
                    ? weddingDate : dateTime(dateValue, prefix + "dateTime");
            EventIcon icon;
            try {
                icon = EventIcon.valueOf(optional(properties, prefix + "icon", "WEDDING").toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException exception) {
                throw new IOException(prefix + "icon must be HALDI, MEHENDI, SANGEET, VIVAH, or WEDDING.", exception);
            }
            events.add(new Event(title, eventDate,
                    optional(properties, prefix + "description", "Join us as we begin our forever."),
                    mapUrl(optional(properties, prefix + "mapsUrl", weddingMap.toString()), prefix + "mapsUrl"),
                    icon));
        }
        return events;
    }

    private static List<StoryPhoto> photos(Properties properties) throws IOException {
        int count = count(properties, "story.photos.count", 3);
        String[] titles = { "Our first chapter", "Little adventures", "Our forever begins" };
        List<StoryPhoto> photos = new ArrayList<>();
        for (int index = 1; index <= count; index++) {
            String prefix = "story.photos." + index + ".";
            String source = index <= 3
                    ? optional(properties, prefix + "source", "assets/images/story-" + index + ".svg")
                    : required(properties, prefix + "source");
            photos.add(new StoryPhoto(assetSource(source, prefix + "source", false),
                    index <= 3 ? optional(properties, prefix + "alt", "Decorative illustration for our story")
                            : required(properties, prefix + "alt"),
                    optional(properties, prefix + "title", index <= 3 ? titles[index - 1] : "A special memory"),
                    optional(properties, prefix + "caption", "A moment to treasure, together.")));
        }
        return photos;
    }

    private static int count(Properties properties, String key, int fallback) throws IOException {
        try {
            int value = Integer.parseInt(optional(properties, key, Integer.toString(fallback)));
            if (value < 0 || value > 100) {
                throw new NumberFormatException("Outside supported range");
            }
            return value;
        } catch (NumberFormatException exception) {
            throw new IOException(key + " must be a whole number between 0 and 100.", exception);
        }
    }

    private static String required(Properties properties, String key) throws IOException {
        String value = properties.getProperty(key);
        if (value == null || value.isBlank()) {
            throw new IOException("Missing required invitation setting: " + key);
        }
        return value.strip();
    }

    private static String language(String value) throws IOException {
        try {
            Locale locale = new Locale.Builder().setLanguageTag(value).build();
            if (locale.getLanguage().isEmpty()) {
                throw new IOException("site.language must include a language, for example en-IN.");
            }
            return locale.toLanguageTag();
        } catch (IllformedLocaleException exception) {
            throw new IOException("site.language must be a valid language tag, for example en-IN.", exception);
        }
    }

    private static ZonedDateTime dateTime(String value, String key) throws IOException {
        try {
            return ZonedDateTime.parse(value, DateTimeFormatter.ISO_ZONED_DATE_TIME);
        } catch (DateTimeParseException exception) {
            throw new IOException(
                    key + " must include a date, time, and offset, for example 2026-11-25T12:45:00+05:30.",
                    exception);
        }
    }

    private static URI mapUrl(String value, String key) throws IOException {
        try {
            URI uri = URI.create(value);
            boolean webScheme = "https".equalsIgnoreCase(uri.getScheme())
                    || "http".equalsIgnoreCase(uri.getScheme());
            if (!uri.isAbsolute() || !webScheme || uri.getHost() == null) {
                throw new IOException(key + " must be a complete HTTPS or HTTP URL.");
            }
            return uri;
        } catch (IllegalArgumentException exception) {
            throw new IOException(key + " must be a valid HTTPS or HTTP URL.", exception);
        }
    }

    private static String assetSource(String value, String key, boolean optional) throws IOException {
        if (optional && value.isEmpty()) {
            return "";
        }
        try {
            URI uri = URI.create(value);
            if (uri.isAbsolute()) {
                if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null) {
                    return uri.toASCIIString();
                }
            } else {
                String path = uri.getPath();
                boolean localAsset = uri.getRawAuthority() == null && path != null && path.startsWith("assets/")
                        && !path.contains("\\") && path.chars().noneMatch(Character::isISOControl);
                if (localAsset) {
                    for (String segment : path.split("/")) {
                        if (segment.equals(".") || segment.equals("..")) {
                            localAsset = false;
                        }
                    }
                }
                if (localAsset) {
                    return uri.toASCIIString();
                }
            }
        } catch (IllegalArgumentException exception) {
            throw new IOException(key + " contains an invalid asset URL.", exception);
        }
        throw new IOException(key + " must be a relative assets/ path without traversal or a complete HTTPS URL.");
    }

    private static String publicUrl(String value) throws IOException {
        if (value.isEmpty()) return "";
        URI uri = mapUrl(value, "site.url");
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getUserInfo() != null
                || uri.getQuery() != null || uri.getFragment() != null) {
            throw new IOException("site.url must be an HTTPS website root without credentials, query, or fragment.");
        }
        return uri.toASCIIString().replaceAll("/+$", "") + "/";
    }

    private static String contactUrl(String value) throws IOException {
        if (value.isEmpty()) return "";
        try {
            URI uri = URI.create(value);
            String destination = uri.getSchemeSpecificPart();
            if (destination == null || destination.chars().anyMatch(Character::isISOControl)
                    || uri.getFragment() != null || uri.getQuery() != null) {
                throw new IllegalArgumentException();
            }
            boolean valid = switch (String.valueOf(uri.getScheme()).toLowerCase(Locale.ROOT)) {
                case "mailto" -> destination.matches("[^\\s?]+@[^\\s?]+");
                case "tel" -> destination.matches("\\+?[0-9][0-9(). -]{3,}");
                case "https" -> uri.getHost() != null && uri.getUserInfo() == null;
                default -> false;
            };
            if (valid) return uri.toASCIIString();
        } catch (IllegalArgumentException ignored) { }
        throw new IOException("contact.url must be a mailto: email address, tel: phone number, or HTTPS link.");
    }
}
