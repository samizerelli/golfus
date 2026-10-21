import AuthenticationServices
import Capacitor

/// « Se connecter avec Apple » (feuille système d'iOS). Renvoie le jeton d'identité signé par Apple,
/// vérifié ensuite par le serveur GolfUs (POST /api/mobile/apple). Module interne à l'app, sans dépendance.
@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)]
    private var pending: CAPPluginCall?
    // Référence conservée pendant la demande : sinon iOS libère le contrôleur avant la réponse
    private var controller: ASAuthorizationController?

    @objc func authorize(_ call: CAPPluginCall) {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        // Empreinte SHA-256 du nonce : le serveur vérifie qu'elle figure dans le jeton
        request.nonce = call.getString("nonce")
        pending = call
        DispatchQueue.main.async {
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.controller = controller
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.webView?.window ?? ASPresentationAnchor()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            pending?.reject("Jeton Apple absent", "failed")
            pending = nil
            return
        }
        let code = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        self.controller = nil
        pending?.resolve([
            "identityToken": token,
            "authorizationCode": code,
            "givenName": credential.fullName?.givenName ?? "",
        ])
        pending = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        self.controller = nil
        let cancelled = (error as? ASAuthorizationError)?.code == .canceled
        pending?.reject(cancelled ? "cancelled" : error.localizedDescription, cancelled ? "cancelled" : "failed")
        pending = nil
    }
}
