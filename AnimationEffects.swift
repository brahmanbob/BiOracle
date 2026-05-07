import SwiftUI
import UIKit

// MARK: - Fade-In Modifier
/// Custom modifier that provides a smooth fade-in transition effect
struct FadeInModifier: ViewModifier {
    @State private var isVisible = false
    let duration: Double
    let delay: Double
    
    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1.0 : 0.0)
            .onAppear {
                withAnimation(.easeInOut(duration: duration).delay(delay)) {
                    isVisible = true
                }
            }
    }
}

// MARK: - Pulse Modifier
/// Custom modifier that creates a gentle pulsing animation effect
/// Useful for drawing attention to critical UI elements
struct PulseModifier: ViewModifier {
    @State private var isAnimating = false
    let when: Bool
    let intensity: Double
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(isAnimating ? 1.05 : 1.0)
            .opacity(isAnimating ? (1.0 - intensity) : 1.0)
            .onAppear {
                if when {
                    withAnimation(
                        Animation.easeInOut(duration: 1.0)
                            .repeatForever(autoreverses: true)
                    ) {
                        isAnimating = true
                    }
                }
            }
            .onChange(of: when) { newValue in
                if newValue {
                    withAnimation(
                        Animation.easeInOut(duration: 1.0)
                            .repeatForever(autoreverses: true)
                    ) {
                        isAnimating = true
                    }
                } else {
                    isAnimating = false
                }
            }
    }
}

// MARK: - Scale Pulse Modifier (Alternative)
/// More pronounced pulse effect with scale animation
struct ScalePulseModifier: ViewModifier {
    @State private var isAnimating = false
    let when: Bool
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(isAnimating ? 1.08 : 1.0)
            .onAppear {
                if when {
                    withAnimation(
                        Animation.easeInOut(duration: 0.8)
                            .repeatForever(autoreverses: true)
                    ) {
                        isAnimating = true
                    }
                }
            }
            .onChange(of: when) { newValue in
                if newValue {
                    withAnimation(
                        Animation.easeInOut(duration: 0.8)
                            .repeatForever(autoreverses: true)
                    ) {
                        isAnimating = true
                    }
                } else {
                    isAnimating = false
                }
            }
    }
}

// MARK: - Glow Modifier
/// Adds a glowing effect around a view
struct GlowModifier: ViewModifier {
    let color: Color
    let radius: CGFloat
    
    func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(0.6), radius: radius, x: 0, y: 0)
            .shadow(color: color.opacity(0.3), radius: radius * 1.5, x: 0, y: 0)
    }
}

// MARK: - Screen Transition Modifier
/// Applies a fade-in effect to an entire screen/view
struct ScreenTransitionModifier: ViewModifier {
    @State private var isVisible = false
    let duration: Double
    
    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1.0 : 0.0)
            .onAppear {
                withAnimation(.easeInOut(duration: duration)) {
                    isVisible = true
                }
            }
    }
}

// MARK: - Blur Modifier
/// Applies a frosted glass blur effect
struct BlurModifier: ViewModifier {
    let style: UIBlurEffect.Style
    
    func body(content: Content) -> some View {
        content
            .background(
                Blur(style: style)
            )
    }
}

// MARK: - Blur View (Internal)
struct Blur: UIViewRepresentable {
    let style: UIBlurEffect.Style
    
    func makeUIView(context: Context) -> UIVisualEffectView {
        let blurEffect = UIBlurEffect(style: style)
        let blurView = UIVisualEffectView(effect: blurEffect)
        return blurView
    }
    
    func updateUIView(_ uiView: UIVisualEffectView, context: Context) {}
}

// MARK: - Extension: View + Animation Modifiers
extension View {
    /// Applies a smooth fade-in transition to the view
    /// - Parameters:
    ///   - duration: Animation duration in seconds (default: 0.6)
    ///   - delay: Delay before animation starts in seconds (default: 0)
    func fadeIn(duration: Double = 0.6, delay: Double = 0) -> some View {
        modifier(FadeInModifier(duration: duration, delay: delay))
    }
    
    /// Applies a gentle pulsing animation when a condition is met
    /// - Parameters:
    ///   - when: Condition to trigger the pulse
    ///   - intensity: Opacity change intensity (0.0 - 1.0, default: 0.3)
    func pulse(when: Bool = true, intensity: Double = 0.3) -> some View {
        modifier(PulseModifier(when: when, intensity: intensity))
    }
    
    /// Applies a more pronounced pulse animation
    func scalePulse(when: Bool = true) -> some View {
        modifier(ScalePulseModifier(when: when))
    }
    
    /// Adds a glowing effect around the view
    /// - Parameters:
    ///   - color: Color of the glow
    ///   - radius: Radius of the glow effect
    func glow(color: Color = .blue, radius: CGFloat = 10) -> some View {
        modifier(GlowModifier(color: color, radius: radius))
    }
    
    /// Applies a fade-in effect to an entire screen
    /// - Parameter duration: Animation duration in seconds
    func screenTransition(duration: Double = 0.5) -> some View {
        modifier(ScreenTransitionModifier(duration: duration))
    }
    
    /// Applies a frosted glass blur effect
    /// - Parameter style: UIBlurEffect style (light, dark, regular, etc.)
    func blur(style: UIBlurEffect.Style = .light) -> some View {
        modifier(BlurModifier(style: style))
    }
}

// MARK: - Tab Navigation with Haptics
/// A custom tab view that triggers haptic feedback when switching tabs
struct TabNavigationWithHaptics<Item: Identifiable, Content: View, Label: View>: View where Item: Hashable {
    @State private var selectedTab: Item.ID?
    let items: [(id: Item.ID, label: () -> Label, content: () -> Content)]
    
    init(_ items: [(label: () -> Label, content: () -> Content)]) where Item.ID == Int {
        self.items = items.enumerated().map { (id: $0.offset, label: $0.element.label, content: $0.element.content) }
        _selectedTab = State(initialValue: 0)
    }
    
    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(items, id: \.id) { item in
                item.content()
                    .tag(item.id)
                    .tabItem {
                        item.label()
                    }
                    .onChange(of: selectedTab) { _ in
                        HapticManager.triggerLightHaptic()
                    }
            }
        }
    }
}

// MARK: - Haptic Manager
/// Centralized manager for all haptic feedback interactions
class HapticManager {
    static let shared = HapticManager()
    
    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
    private let selection = UISelectionFeedbackGenerator()
    private let notification = UINotificationFeedbackGenerator()
    
    private init() {
        prepareAllGenerators()
    }
    
    // MARK: - Private Preparation
    private func prepareAllGenerators() {
        lightImpact.prepare()
        mediumImpact.prepare()
        heavyImpact.prepare()
        selection.prepare()
        notification.prepare()
    }
    
    // MARK: - Static Haptic Methods
    
    /// Triggers a light haptic feedback (subtle tap)
    /// Use for: Tab navigation, subtle interactions
    static func triggerLightHaptic() {
        HapticManager.shared.lightImpact.impactOccurred()
    }
    
    /// Triggers a medium haptic feedback (noticeable tap)
    /// Use for: Button presses, important interactions
    static func triggerMediumHaptic() {
        HapticManager.shared.mediumImpact.impactOccurred()
    }
    
    /// Triggers a heavy haptic feedback (strong tap)
    /// Use for: Confirmations, critical actions
    static func triggerHeavyHaptic() {
        HapticManager.shared.heavyImpact.impactOccurred()
    }
    
    /// Triggers a selection feedback (quick double tap)
    /// Use for: Picker changes, selection updates
    static func triggerSelectionHaptic() {
        HapticManager.shared.selection.selectionChanged()
    }
    
    /// Triggers notification feedback (success/warning/error)
    /// - Parameter type: Type of notification (.success, .warning, .error)
    static func triggerNotificationHaptic(type: UINotificationFeedbackGenerator.FeedbackType) {
        HapticManager.shared.notification.notificationOccurred(type)
    }
    
    // MARK: - Convenience Methods
    
    /// Success notification with haptic feedback
    static func triggerSuccess() {
        triggerNotificationHaptic(type: .success)
    }
    
    /// Warning notification with haptic feedback
    static func triggerWarning() {
        triggerNotificationHaptic(type: .warning)
    }
    
    /// Error notification with haptic feedback
    static func triggerError() {
        triggerNotificationHaptic(type: .error)
    }
}
