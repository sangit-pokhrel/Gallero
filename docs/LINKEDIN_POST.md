# LinkedIn launch post

> Copy everything between the lines. Attach `docs/images/banner.png` (or `screens.png`) as the image.
> Replace `<github-link>` with your repository URL before posting.

---

I got tired of my gallery app. So I built my own. 📸

Every gallery I tried on Android had the same problems:
→ Laggy the moment your library gets big
→ Ads and "go premium" pop-ups between your own memories
→ Or, in the case of the big cloud apps, an account + uploading everything just to look at photos that are already on my phone
→ And almost no control over how any of it looks

iPhone users get Apple Photos — People, Memories, a locked Hidden album, Recently Deleted, that smooth pinch-to-zoom. On Android, that experience is scattered across apps that all want something from you: your attention, your data, or your money.

So I built **Gallero** — an Apple Photos–inspired gallery for Android that runs 100% on the device.

What makes it different:

🔒 **Private by design** — no ads, no account, no cloud, no servers. Nothing leaves the phone.
🧠 **On-device People** — faces are detected with ML Kit and grouped with a MobileFaceNet model running locally. Name people, merge duplicates, search by name.
🗂️ **Collections** — Memories ("On This Day", Year in Review), Pinned, Albums, Recent Days, Media Types, Duplicates.
🛡️ **Locked Hidden & Recently Deleted** — opens with fingerprint, face or your screen-lock PIN/pattern; deleted photos are recoverable for 30 days.
✋ **Gestures that feel right** — zoom out of the thumbnail, pinch around your fingers, momentum panning, swipe down to dismiss. Gestures run on the UI thread, so they don't wait on JavaScript.
🎨 **Fully customizable** — 5 themes (incl. AMOLED & Paper), 10 accent colours, 4 typefaces, grid density, spacing, corner style, grouping, glass effects.
⚡ **Adapts to your phone** — real glass blur on newer phones, lighter effects and smarter memory use on older ones.

Under the hood: React Native (New Architecture) + Expo SDK 58, Reanimated 4, Gesture Handler 3, FlashList, a small custom native module for ML Kit, and TensorFlow Lite for face embeddings — plus unit tests and a QA report.

The biggest lesson? "Smooth" isn't a feature you add at the end. It's dozens of small decisions — which thread a gesture runs on, what gets re-laid-out every frame, how much you keep in memory — and you only find them by testing on a real device with a real library of thousands of photos.

Gallero is source-available — have a look at the code and the design decisions here: <github-link>

What's the one feature your gallery app is missing? 👇

#AndroidDev #ReactNative #Expo #MobileDevelopment #Privacy #OnDeviceAI #UIDesign #BuildInPublic
