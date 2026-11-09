# Sign-in email templates

Paste these into Supabase > Authentication > Emails, on both **Magic link or OTP** and
**Confirm signup**. Custom SMTP must be on first (sender `nka.studio@motionplaylabs.com`,
name `Nka Studio`, host `smtp.resend.com`, port 465, username `resend`, password a Resend key).

The code works on any device. The button opens `/auth/confirm`, which asks for one click, so
email scanners that open links can't use it up.

## Subject

```
Your Nka Studio sign-in code: {{ .Token }}
```

## Body (Source tab)

```html
<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1b3a;max-width:480px;margin:0 auto;padding:24px">
  <p style="font-size:20px;font-weight:700;margin:0 0 20px">Nka Studio</p>
  <p style="margin:0 0 8px">Your sign-in code:</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:0 0 24px">{{ .Token }}</p>
  <p style="margin:0 0 20px">Enter it on the page you came from, or use the button below on any device.</p>
  <p style="margin:0 0 28px">
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
       style="display:inline-block;background:#e0a526;color:#1a1b3a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Sign in to Nka Studio</a>
  </p>
  <p style="color:#5b5e72;font-size:14px;margin:0 0 6px">The code and button work once and expire in an hour.</p>
  <p style="color:#5b5e72;font-size:14px;margin:0 0 24px">Didn't ask for this? Ignore this email. Nobody can sign in without it.</p>
  <p style="color:#5b5e72;font-size:13px;margin:0;border-top:1px solid #dcddd6;padding-top:16px">Nka Studio, a studio of MotionPlay Labs Ltd</p>
</div>
```

`{{ .SiteURL }}` is the Site URL under Authentication > URL Configuration. Set it to the live address.
