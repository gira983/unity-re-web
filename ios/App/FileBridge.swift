import Foundation
import WebKit

/// Serves files picked in the native document picker to the web app
/// over reweb-file://<token>/<name> requests.
final class FileBridge: NSObject, WKURLSchemeHandler {
    static let scheme = "reweb-file"
    private static var files: [String: URL] = [:]

    static func register(_ url: URL) -> String {
        // URL.host comes back lowercased, so tokens must be lowercase to match
        let token = UUID().uuidString.lowercased()
        files[token] = url
        return token
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url,
              let token = url.host?.lowercased(),
              let fileURL = FileBridge.files[token] else {
            task.didFailWithError(URLError(.badURL))
            return
        }
        let data: Data
        do { data = try Data(contentsOf: fileURL) }
        catch { task.didFailWithError(error); return }
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil,
            headerFields: [
                "Content-Type": "application/octet-stream",
                "Content-Length": String(data.count),
                "Access-Control-Allow-Origin": "*",
            ])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
