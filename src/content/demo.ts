// Options for the demo questions. Kept here so the form and the server check agree.

export const FIRST_NEEDS = [
  "A pitch deck for investors",
  "Social ads for a launch",
  "A new logo and brand identity",
  "An annual report",
  "Branding for an event",
  "A website design",
];

export const VOLUMES: { value: string; label: string; hint: string }[] = [
  { value: "few", label: "A few pieces a month", hint: "Decks, posts and documents now and then" },
  { value: "steady", label: "Something every week", hint: "Campaigns, social and sales material" },
  { value: "team", label: "A full design team's worth", hint: "Several projects running at once" },
  { value: "project", label: "One big project", hint: "An identity, a launch, an event" },
  { value: "unsure", label: "Not sure yet", hint: "We'll work it out together" },
];

export const TEAM_SIZES = ["Just me", "2 to 10", "11 to 50", "51 to 200", "More than 200"];

export const COUNTRIES = ["United Kingdom", "Nigeria", "Ghana", "Kenya", "South Africa", "United States", "Other"];

export const CALL_TIMES = ["Weekday mornings", "Weekday afternoons", "Any time", "Email me instead"];
