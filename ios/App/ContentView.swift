import SwiftUI
import UniformTypeIdentifiers
import WebKit

struct ContentView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(FileBridge(), forURLScheme: FileBridge.scheme)
        // the web app posts "openFilePicker" here instead of clicking <input type=file>,
        // which cannot open a picker inside WKWebView before iOS 18.4
        config.userContentController.add(context.coordinator, name: "openFilePicker")
        let web = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = web
        // "Web" is a folder reference: the vite build is copied here by CI
        if let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") {
            web.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, UIDocumentPickerDelegate {
        weak var webView: WKWebView?

        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard message.name == "openFilePicker" else { return }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.data], asCopy: true)
            picker.delegate = self
            Self.topViewController().present(picker, animated: true)
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            let payload: [String: Any] = [
                "tokens": urls.map { FileBridge.register($0) },
                "names": urls.map { $0.lastPathComponent },
            ]
            guard let data = try? JSONSerialization.data(withJSONObject: payload),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView?.evaluateJavaScript("window.__nativeFilesPicked(\(json))", completionHandler: nil)
        }

        static func topViewController() -> UIViewController {
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
            var vc = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
            while let presented = vc?.presentedViewController { vc = presented }
            return vc ?? UIViewController()
        }
    }
}
