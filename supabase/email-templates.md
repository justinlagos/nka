# Sign-in email templates

Paste these into Supabase > Authentication > Emails. Use the same template for both
**Magic link** and **Confirm signup** (new people get "Confirm signup", returning people get "Magic link").

The code works on any device. The link opens `/auth/confirm`, which asks for one click, so
email scanners that open links can't use it up.

## Subject

```
Your Nka sign-in code: {{ .Token }}
```

## Body (HTML)

```html
<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1b3a;max-width:480px">
  <p style="font-size:22px;font-weight:700;margin:0 0 16px">Sign in to Nka</p>
  <p style="margin:0 0 8px">Your code:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 20px">{{ .Token }}</p>
  <p style="margin:0 0 20px">Type it on the page you came from. Or open this link on any device:</p>
  <p style="margin:0 0 24px">
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
       style="background:#e0a526;color:#1a1b3a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Sign in</a>
  </p>
  <p style="color:#5b5e72;font-size:14px;margin:0">The code and link work once and expire in an hour. If you didn't ask for this, ignore this email.</p>
</div>
```

`{{ .SiteURL }}` is the Site URL under Authentication > URL configuration. Set it to the live address.
