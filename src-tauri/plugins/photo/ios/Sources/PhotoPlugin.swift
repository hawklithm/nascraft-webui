import Foundation
import Tauri
import MobileCoreServices

@objc public class PhotoPlugin: NSObject, Plugin {
    public func getAlbumPaths(_ invoke: Invoke) -> Void {
        // iOS implementation would go here
        // For now, return empty array
        let result = ["path1", "path2"]
        invoke.resolve(["paths": result, "count": result.count])
    }
}