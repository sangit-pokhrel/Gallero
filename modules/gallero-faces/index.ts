import { requireOptionalNativeModule } from 'expo';

export type DetectedFace = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Head turn left/right in degrees. */
  yaw: number;
  /** Head tilt in degrees. */
  roll: number;
  imageWidth: number;
  imageHeight: number;
};

type Native = { detect(uri: string): Promise<DetectedFace[]> };

const native = requireOptionalNativeModule<Native>('GalleroFaces');

/** Null on platforms where on-device face detection isn't built in. */
export const GalleroFaces = native;
