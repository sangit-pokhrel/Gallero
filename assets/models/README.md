`mobilefacenet.tflite` is converted from the pretrained MobileFaceNet in
https://github.com/sirius-ai/MobileFaceNet_TF (Apache-2.0),
`arch/pretrained_model/MobileFaceNet_9925_9680.pb`.

Input: 1×112×112×3 float32, RGB normalised as (x − 127.5) / 128.
Output: 1×128 float32, L2-normalised face embedding.

Quantized: 8-bit dynamic-range weights (1.5 MB; cosine similarity vs. the float model ≥ 0.998 on test inputs).
