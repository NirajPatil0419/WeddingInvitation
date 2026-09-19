package com.weddinginvitation.template;

import com.weddinginvitation.config.WeddingConfig;
import com.weddinginvitation.config.WeddingConfig.EventIcon;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Repeating page sections. Configuration values always pass through HTML escaping. */
public final class InvitationFragments {
    private InvitationFragments() { }

    public static HtmlTemplate.Fragment events(WeddingConfig config) {
        Locale locale = Locale.forLanguageTag(config.language());
        DateTimeFormatter date = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy", locale);
        DateTimeFormatter time = DateTimeFormatter.ofPattern("h:mm a", locale);
        List<HtmlTemplate.Fragment> cards = new ArrayList<>();
        int index = 0;
        for (WeddingConfig.Event event : config.events()) {
            index++;
            HtmlTemplate.Fragment dressCode = event.dressCode().isEmpty()
                    ? HtmlTemplate.fragment("", Map.of())
                    : HtmlTemplate.fragment("<p class=\"event-dresscode\"><span>Dress code</span> {{dressCode}}</p>",
                            Map.of("dressCode", event.dressCode()));
            cards.add(HtmlTemplate.fragment("""
                    <article class="event-card reveal" data-event-index="{{index}}">
                      <span class="event-number">{{number}}</span>
                      <span class="event-icon" aria-hidden="true">{{{icon}}}</span>
                      <h3 class="event-title">{{title}}</h3>
                      <p class="event-date">{{date}}</p>
                      <time class="event-time" datetime="{{dateTime}}">{{time}}</time>
                      <p class="event-description">{{description}}</p>
                      {{{dressCode}}}
                      <a class="event-map" href="{{mapUrl}}" target="_blank" rel="noopener noreferrer">View location <span aria-hidden="true">&#8599;</span><span class="visually-hidden"> (opens in a new tab)</span></a>
                    </article>
                    """, Map.of(
                    "index", Integer.toString(index),
                    "number", String.format(Locale.ROOT, "%02d", index),
                    "title", event.title(),
                    "date", date.format(event.dateTime()),
                    "dateTime", DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(event.dateTime()),
                    "time", time.format(event.dateTime()),
                    "description", event.description(),
                    "mapUrl", event.mapUrl().toASCIIString()),
                    Map.of("icon", icon(event.icon()), "dressCode", dressCode)));
        }
        return HtmlTemplate.join(cards);
    }

    public static HtmlTemplate.Fragment photos(WeddingConfig config) {
        List<HtmlTemplate.Fragment> photos = new ArrayList<>();
        int index = 0;
        for (WeddingConfig.StoryPhoto photo : config.photos()) {
            index++;
            photos.add(HtmlTemplate.fragment("""
                    <figure class="polaroid reveal">
                      <img src="{{source}}" alt="{{alt}}" width="600" height="750" loading="lazy" decoding="async">
                      <figcaption>
                        <span class="story-number">{{number}}</span>
                        <h3>{{title}}</h3>
                        <p>{{caption}}</p>
                      </figcaption>
                    </figure>
                    """, Map.of("source", photo.source(), "alt", photo.alt(),
                    "number", String.format(Locale.ROOT, "%02d", index),
                    "title", photo.title(), "caption", photo.caption())));
        }
        return HtmlTemplate.join(photos);
    }

    private static HtmlTemplate.Fragment icon(EventIcon icon) {
        String drawing = switch (icon) {
            case HALDI -> "<path d=\"M7 23h26c-1 8-5 12-13 12S8 31 7 23Z\"/><path d=\"M13 18c0-4 4-4 4-8m6 8c0-4 4-4 4-8M5 23h30\"/>";
            case MEHENDI -> "<path d=\"M20 35V17m0 12C8 29 8 20 8 20s12 0 12 9Zm0-8c10 0 12-10 12-10s-12 0-12 10Zm0-6C11 15 12 5 12 5s8 2 8 10Z\"/>";
            case SANGEET -> "<path d=\"M16 29V9l17-4v21M16 15l17-4\"/><ellipse cx=\"11\" cy=\"30\" rx=\"5\" ry=\"4\"/><ellipse cx=\"28\" cy=\"27\" rx=\"5\" ry=\"4\"/>";
            case WEDDING -> "<circle cx=\"14\" cy=\"25\" r=\"10\"/><circle cx=\"27\" cy=\"25\" r=\"10\"/><path d=\"m13 11 7-7 7 7-7 8-7-8Zm0 0h14M20 4v15\"/>";
        };
        // The drawing comes only from the enum above; editable properties cannot supply SVG.
        return HtmlTemplate.fragment("<svg viewBox=\"0 0 42 42\" width=\"42\" height=\"42\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" focusable=\"false\">"
                + drawing + "</svg>", Map.of());
    }
}
