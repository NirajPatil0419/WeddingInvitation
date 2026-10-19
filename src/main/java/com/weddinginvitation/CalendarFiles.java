package com.weddinginvitation;

import com.weddinginvitation.config.WeddingConfig;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/** RFC 5545 downloads with UTC instants and UTF-8-safe line folding. */
public final class CalendarFiles {
    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmmss'Z'")
            .withZone(ZoneOffset.UTC);
    private CalendarFiles() { }

    public static void write(Path site, WeddingConfig config) throws IOException {
        Path directory = site.resolve("calendar");
        Files.createDirectories(directory);
        String couple = config.groomName() + " & " + config.brideName();
        String location = config.venueName() + ", " + config.venueAddress();
        Files.writeString(directory.resolve("wedding.ics"), render(couple + " | Wedding", config.weddingDateTime(),
                location, config.invitationMessage() + "\n" + config.venueMapUrl(),
                couple + "|wedding", config.publicUrl()), StandardCharsets.UTF_8);
        for (int index = 0; index < config.events().size(); index++) {
            WeddingConfig.Event event = config.events().get(index);
            boolean mainVenue = event.mapUrl().equals(config.venueMapUrl());
            String id = event.dateTime().toInstant().equals(config.weddingDateTime().toInstant())
                    && event.icon() == WeddingConfig.EventIcon.WEDDING ? "wedding" : "event-" + (index + 1);
            Files.writeString(directory.resolve("event-" + (index + 1) + ".ics"), render(couple + " | " + event.title(),
                    event.dateTime(), mainVenue ? location : event.mapUrl().toString(),
                    event.description() + "\n" + event.mapUrl(), couple + "|" + id, config.publicUrl()), StandardCharsets.UTF_8);
        }
    }

    public static String render(String title, ZonedDateTime start, String location, String description,
                                String identity, String url) {
        StringBuilder calendar = new StringBuilder();
        for (String line : new String[]{"BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wedding Invitation//EN",
                "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
                "UID:" + UUID.nameUUIDFromBytes(identity.getBytes(StandardCharsets.UTF_8)) + "@wedding-invitation",
                "DTSTAMP:" + UTC.format(Instant.now()), "DTSTART:" + UTC.format(start),
                "SUMMARY:" + escape(title), "LOCATION:" + escape(location), "DESCRIPTION:" + escape(description)}) {
            appendLine(calendar, line);
        }
        if (!url.isEmpty()) appendLine(calendar, "URL:" + url);
        appendLine(calendar, "END:VEVENT");
        appendLine(calendar, "END:VCALENDAR");
        return calendar.toString();
    }

    private static String escape(String text) {
        return text.replace("\\", "\\\\").replace("\r\n", "\n").replace("\r", "\n")
                .replace("\n", "\\n").replace(";", "\\;").replace(",", "\\,");
    }

    private static void appendLine(StringBuilder output, String line) {
        int octets = 0;
        for (int point : line.codePoints().toArray()) {
            String character = new String(Character.toChars(point));
            int size = character.getBytes(StandardCharsets.UTF_8).length;
            if (octets + size > 75) { output.append("\r\n "); octets = 1; }
            output.append(character);
            octets += size;
        }
        output.append("\r\n");
    }
}
