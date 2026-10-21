import Capacitor

/// Contrôleur principal : enregistre les modules natifs propres à GolfUs.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppleSignInPlugin())
    }
}
