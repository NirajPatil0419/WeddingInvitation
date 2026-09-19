package com.weddinginvitation.template;

import java.util.Map;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Escapes {{text}} values and accepts generated HTML only through {{{fragment}}}. */
public final class HtmlTemplate {
    private static final Pattern PLACEHOLDER = Pattern.compile(
            "\\{\\{\\{([a-zA-Z][a-zA-Z0-9]*)}}}|\\{\\{([a-zA-Z][a-zA-Z0-9]*)}}");

    /** HTML assembled from developer-owned templates, with configuration text escaped. */
    public static final class Fragment {
        private final String html;

        private Fragment(String html) {
            this.html = html;
        }
    }

    private HtmlTemplate() {
    }

    public static String render(String template, Map<String, String> values) {
        return render(template, values, Map.of());
    }

    public static String render(String template, Map<String, String> values, Map<String, Fragment> fragments) {
        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String fragmentKey = matcher.group(1);
            String replacement;
            if (fragmentKey != null) {
                Fragment fragment = fragments.get(fragmentKey);
                if (fragment == null) {
                    throw new IllegalArgumentException("No generated HTML fragment supplied: " + fragmentKey);
                }
                replacement = fragment.html;
            } else {
                String key = matcher.group(2);
                String value = values.get(key);
                if (value == null) {
                    throw new IllegalArgumentException("No value supplied for template placeholder: " + key);
                }
                replacement = escape(value);
            }
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    public static Fragment fragment(String template, Map<String, String> values) {
        return new Fragment(render(template, values));
    }

    public static Fragment fragment(String template, Map<String, String> values, Map<String, Fragment> fragments) {
        return new Fragment(render(template, values, fragments));
    }

    public static Fragment join(List<Fragment> fragments) {
        StringBuilder html = new StringBuilder();
        for (Fragment fragment : fragments) {
            html.append(fragment.html);
        }
        return new Fragment(html.toString());
    }

    // These placeholders are for HTML text/attributes, never raw scripts or styles.
    private static String escape(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
