export const lessonIds = [
  "swim",
  "glance",
  "grab",
  "flick",
  "curl",
  "reverse",
  "dummy",
  "rise",
  "dive",
] as const;

export type LessonId = (typeof lessonIds)[number];

type LessonContent = {
  title: string;
  text: string;
  desktop: string;
  hint: string;
  touch: string;
  image?: string;
};

export const lessons: Record<LessonId, LessonContent> = {
  swim: {
    title: "Swim",
    hint: "Keep swimming forward. Turn your body to steer.",
    text: "Swim a short distance. Turn your body to steer.",
    desktop: "[[{forward} / {left} / {brake} / {right}]] · [[Mouse]] to look",
    touch: "[[Left stick]] to swim · Drag right side to look",
  },
  glance: {
    title: "Look around",
    hint: "Glance in both directions without turning your body.",
    text: "Look left and right without changing direction.",
    desktop:
      "Hold [[{glanceLeft}]] to look left · Hold [[{glanceRight}]] to look right",
    touch: "Hold [[← Look]] · Hold [[Look →]]",
  },
  grab: {
    title: "Grab the puck",
    hint: "Swim your stick onto the puck, or use [[Grab]] when you are close.",
    text: "Swim to the puck and take possession.",
    desktop: "Swim onto it · or press [[{grab}]]",
    touch: "Swim onto it · or tap [[Grab]]",
  },
  flick: {
    title: "Flick",
    hint: "Bring the puck back to your stick and flick it.",
    text: "Flick the puck forwards.",
    desktop: "Hold [[{shoot}]] · aim · release",
    touch: "Hold [[Shoot]] · drag to aim · release",
    image: "shot",
  },
  curl: {
    title: "Curl",
    hint: "Keep turning {curlDirection} for one full circle.",
    text: "Stop swimming, then turn {curlDirection} for one full curl.",
    desktop: "Release [[{forward}]] · turn {curlDirection}",
    touch: "Release the joystick · swipe {curlDirection}",
    image: "curl",
  },
  reverse: {
    title: "Reverse curl",
    hint: "Keep turning {reverseDirection} for one full circle.",
    text: "Stop swimming, then turn {reverseDirection} for one full reverse curl.",
    desktop: "Release [[{forward}]] · turn {reverseDirection}",
    touch: "Release the joystick · swipe {reverseDirection}",
    image: "curl",
  },
  dummy: {
    title: "Dummy",
    hint: "Complete a successful dummy using {dummyControls} and sprint after.",
    text: "Stickhandle and swerve around your opponents while moving.",
    desktop: "Hold [[{dummy}]] + [[{left}]] or [[{right}]]",
    touch: "Hold [[Dummy]] + steer",
    image: "dummy",
  },
  rise: {
    title: "Get air",
    hint: "Keep rising until you reach the surface.",
    text: "Reach the surface to refill your air.",
    desktop: "Hold [[{rise}]]",
    touch: "Hold [[Rise]]",
  },
  dive: {
    title: "Dive",
    hint: "Keep diving until you reach the floor.",
    text: "Return to the floor to play the puck.",
    desktop: "Hold [[{descend}]]",
    touch: "Hold [[Dive]]",
  },
};
