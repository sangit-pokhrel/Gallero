package expo.modules.gallerofaces

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Finds faces in a local image with Google ML Kit, entirely on device. */
class GalleroFacesModule : Module() {
  private val detector by lazy {
    FaceDetection.getClient(
      FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
        .setMinFaceSize(0.1f)
        .build()
    )
  }

  override fun definition() = ModuleDefinition {
    Name("GalleroFaces")

    AsyncFunction("detect") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(CodedException("React context is not available"))
        return@AsyncFunction
      }
      try {
        val image = InputImage.fromFilePath(context, Uri.parse(uri))
        detector.process(image)
          .addOnSuccessListener { faces ->
            promise.resolve(faces.map { f ->
              mapOf(
                "x" to f.boundingBox.left.toDouble(),
                "y" to f.boundingBox.top.toDouble(),
                "width" to f.boundingBox.width().toDouble(),
                "height" to f.boundingBox.height().toDouble(),
                "yaw" to f.headEulerAngleY.toDouble(),
                "roll" to f.headEulerAngleZ.toDouble(),
                "imageWidth" to image.width.toDouble(),
                "imageHeight" to image.height.toDouble()
              )
            })
          }
          .addOnFailureListener { e -> promise.reject(CodedException(e.message ?: "Face detection failed", e)) }
      } catch (e: Exception) {
        promise.reject(CodedException(e.message ?: "Could not read image", e))
      }
    }
  }
}
