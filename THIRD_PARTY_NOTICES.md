# Third-party notices

Gallero's own code is covered by [LICENSE](LICENSE). The components below keep their own
licenses, which take precedence for those components.

## MobileFaceNet model

`assets/models/mobilefacenet.tflite` is a TensorFlow Lite conversion of the pretrained model
`arch/pretrained_model/MobileFaceNet_9925_9680.pb` from
<https://github.com/sirius-ai/MobileFaceNet_TF>.

Licensed under the **Apache License, Version 2.0**: <https://www.apache.org/licenses/LICENSE-2.0>.
Modification: converted from a TensorFlow frozen graph to TensorFlow Lite with 8-bit dynamic-range
weight quantization (input `1×112×112×3`, output `1×128` L2-normalised embedding).

## Google ML Kit

Face detection uses Google ML Kit via Google Play services
(`com.google.android.gms:play-services-mlkit-face-detection`), subject to the
[ML Kit Terms of Service](https://developers.google.com/ml-kit/terms).

## Open-source libraries

Gallero is built with open-source packages (Expo, React Native, React, Reanimated,
Gesture Handler, FlashList, react-native-fast-tflite, jpeg-js and others). Each is used under
its own license (mostly MIT / Apache-2.0 / BSD); see the `license` field of each package in
`node_modules` or run `npx license-checker --summary`.
