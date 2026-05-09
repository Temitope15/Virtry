import type { MerchItem } from "./types";

const SHARED_RULES = `
HARD CONSTRAINTS — every one of these must hold in the output:
- Identity: preserve the person's face exactly. Same skin tone, eye color, eye shape, eyebrows, nose, mouth, jawline, hairstyle, facial hair, expression, age. Do NOT slim, age, beautify, lighten, or otherwise alter the face. The output must be unmistakably the same person.
- Body: preserve pose, body proportions, posture, hand positions, and any visible limbs. Do NOT add or remove fingers, arms, or other body parts. Do NOT distort the body.
- Background: keep the original background, props, and lighting unchanged.
- Camera: keep the same framing, crop, perspective, and aspect ratio as the input photo.
- Lighting: cast realistic shadows and highlights on the new garment that match the photo's existing light direction and color temperature. The garment must look physically present, not pasted.
- Fidelity to merch reference: match the merch image's exact color, print, logos, text, stitching, and proportions. Treat the merch image strictly as a reference of what the item looks like — render it as if it were physically worn (with natural fabric folds, contact shadows, and perspective on the body).
- No additions: do NOT add text, watermarks, logos, accessories, or anything that is not present in either input image.
- No removals beyond what the new garment naturally covers.
- Output must be a single photorealistic image, sharp and well-exposed.

FAILURE MODES TO AVOID:
- Floating garments that don't touch the body.
- Mismatched lighting (e.g., garment lit from a different direction than the face).
- Wrong size (item floating around the body or clipping into it).
- Distorted or duplicated logos / text.
- Re-rendered or stylized faces. Cartoonish output.
- Changing the person's race, gender, body shape, or age.
- Cropping out parts of the person that were visible in the input.
`;

export function buildTryOnPrompt(item: MerchItem): string {
  const intro = `You are given two images:
1. FIRST IMAGE — a real photo of a person.
2. SECOND IMAGE — a flat product photo of "${item.name}".

Your task: produce a single new photorealistic image of the SAME person from the first image, now wearing the item from the second image. Keep everything else about the photo identical.`;

  switch (item.id) {
    case "cap-grey-navy":
      return `${intro}

ITEM-SPECIFIC INSTRUCTIONS — snapback cap:
- Place the cap on the crown of the person's head, facing forward.
- The brim should sit just above the eyebrows, casting a soft realistic shadow on the upper face/forehead.
- Align the cap's centerline with the bridge of the nose.
- Tilt the cap to match the head's tilt, rotation, and angle in the photo (yaw, pitch, roll).
- Sizing: the cap must fit the head snugly. The band should hug the head circumference. It must not float above the hair or clip into the skull.
- Hair: hair on top of the head is hidden by the cap. Hair around and below the cap (sideburns, hair behind the ears, hair at the back/sides) remains visible and natural.
- The cap's color, panels, button, and any front logo/print must match the SECOND IMAGE exactly.
${SHARED_RULES}`;

    case "headband-black":
      return `${intro}

ITEM-SPECIFIC INSTRUCTIONS — headband:
- Wrap the headband across the person's forehead, just above the eyebrows, at roughly the hairline. The band wraps around the head and is partly visible at the sides.
- Match the head's tilt, rotation, and angle.
- Sizing: snug fit. The band must follow the curvature of the skull. It must not float, and must not clip into the head.
- Hair: hair above and below the band remains visible naturally; the band sits over the hair, not under the scalp. The hair on top of the head is NOT covered (this is a band, not a cap).
- The band's color, print, text, and proportions must match the SECOND IMAGE exactly.
${SHARED_RULES}`;

    case "jacket-black":
      return `${intro}

ITEM-SPECIFIC INSTRUCTIONS — hooded jacket:
- Replace the person's currently visible upper-body garment with this jacket. If any of the original garment is showing through the collar, sleeves, or hem, fully replace it.
- The hood rests naturally behind the neck and shoulders (down, not pulled up).
- The collar sits naturally against the neck — no floating, no clipping.
- Sleeves end at the wrists. If the hands are visible in the original photo, keep them visible past the cuffs.
- Render realistic fabric folds where the body bends (shoulders, elbows, waist) following the person's pose.
- Render the zipper, drawstrings, pockets, and any front print/logo exactly as shown in the SECOND IMAGE.
- The jacket's color and texture must match the SECOND IMAGE exactly.
${SHARED_RULES}`;

    case "hoodie-navy":
      return `${intro}

ITEM-SPECIFIC INSTRUCTIONS — pullover hoodie:
- Replace the person's currently visible upper-body garment with this hoodie. Fully cover any of the original garment that would be hidden by a hoodie.
- The hood rests naturally behind the neck and shoulders (down, not pulled up).
- The rib-knit neckline sits naturally against the neck — no floating, no clipping.
- Sleeves end at the wrists with rib-knit cuffs. If hands are visible in the original photo, keep them visible past the cuffs.
- Render realistic fabric folds at the shoulders, elbows, and waist following the person's pose. Show the kangaroo pocket if it's visible at the body's angle.
- Render the drawstrings and any front print/logo exactly as shown in the SECOND IMAGE.
- The hoodie's color and texture must match the SECOND IMAGE exactly.
${SHARED_RULES}`;

    case "tee-white":
      return `${intro}

ITEM-SPECIFIC INSTRUCTIONS — t-shirt:
- Replace the person's currently visible upper-body garment with this t-shirt. Fully cover any of the original garment that would be hidden by a t-shirt.
- The crew neckline sits naturally against the neck — no floating, no clipping.
- Short sleeves end at the upper arms.
- Render realistic fabric folds at the shoulders and torso following the person's pose.
- Render any front print, text, or logo exactly as shown in the SECOND IMAGE — same position, scale, color, and clarity. Do NOT distort or re-letter text.
- The t-shirt's base color must match the SECOND IMAGE exactly.
${SHARED_RULES}`;

    default:
      return `${intro}

ITEM-SPECIFIC INSTRUCTIONS:
- Place the item from the SECOND IMAGE onto the person in the most natural and realistic way for that kind of item.
- Match its color, print, and proportions exactly.
- Render realistic fabric/material behavior, fit, and shadows for the body's pose.
${SHARED_RULES}`;
  }
}
