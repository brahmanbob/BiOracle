import SwiftUI

// MARK: - Glassmorphism Card View
/// A reusable card component with frosted glass effect, blur, and glowing borders
/// Perfect for dashboard displays and information cards
struct GlassmorphismCardView<Content: View>: View {
    let glowColor: Color
    let glowIntensity: Double
    let cornerRadius: CGFloat
    @ViewBuilder let content: Content
    
    /// Initialize a Glassmorphism Card
    /// - Parameters:
    ///   - glowColor: Color of the glowing border (default: .blue)
    ///   - glowIntensity: Opacity of the glow effect 0.0-1.0 (default: 0.6)
    ///   - cornerRadius: Radius of the card corners (default: 20)
    ///   - content: ViewBuilder closure for card content
    init(
        glowColor: Color = .blue,
        glowIntensity: Double = 0.6,
        cornerRadius: CGFloat = 20,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.glowColor = glowColor
        self.glowIntensity = glowIntensity
        self.cornerRadius = cornerRadius
        self.content = content()
    }
    
    var body: some View {
        ZStack {
            // MARK: - Background Blur Layer
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.white.opacity(0.15),
                            Color.white.opacity(0.05)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .background(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .fill(.ultraThinMaterial)
                )
            
            // MARK: - Inner Glow Effect
            RoundedRectangle(cornerRadius: cornerRadius)
                .stroke(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            glowColor.opacity(glowIntensity * 0.8),
                            glowColor.opacity(glowIntensity * 0.3),
                            glowColor.opacity(glowIntensity * 0.1)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.5
                )
                .shadow(
                    color: glowColor.opacity(glowIntensity * 0.6),
                    radius: 8,
                    x: 0,
                    y: 0
                )
            
            // MARK: - Content Layer
            VStack {
                content
            }
            .padding(16)
        }
        .shadow(
            color: Color.black.opacity(0.1),
            radius: 12,
            x: 0,
            y: 4
        )
    }
}

// MARK: - Glassmorphism Card Variants

/// Glassmorphism card optimized for health metrics
struct HealthMetricCard<Content: View>: View {
    @ViewBuilder let content: Content
    let backgroundColor: Color
    
    var body: some View {
        GlassmorphismCardView(
            glowColor: backgroundColor,
            glowIntensity: 0.7,
            cornerRadius: 16
        ) {
            content
        }
    }
}

/// Glassmorphism card with centered content
struct CenteredGlassmorphismCard<Content: View>: View {
    @ViewBuilder let content: Content
    let glowColor: Color
    
    var body: some View {
        GlassmorphismCardView(
            glowColor: glowColor,
            glowIntensity: 0.6,
            cornerRadius: 20
        ) {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

/// Glassmorphism card with icon and label
struct IconGlassmorphismCard: View {
    let icon: String
    let label: String
    let value: String
    let glowColor: Color
    let systemImage: Bool
    
    var body: some View {
        GlassmorphismCardView(
            glowColor: glowColor,
            glowIntensity: 0.6,
            cornerRadius: 16
        ) {
            VStack(spacing: 8) {
                if systemImage {
                    Image(systemName: icon)
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundColor(glowColor)
                } else {
                    Text(icon)
                        .font(.system(size: 24, weight: .semibold))
                }
                
                Text(label)
                    .font(.caption)
                    .foregroundColor(.gray)
                
                Text(value)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
            }
            .padding(.vertical, 12)
        }
    }
}

// MARK: - Preview
struct GlassmorphismCardView_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            // Background gradient for preview
            LinearGradient(
                gradient: Gradient(colors: [
                    Color.blue.opacity(0.3),
                    Color.purple.opacity(0.3)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack(spacing: 20) {
                // MARK: - Basic Card
                GlassmorphismCardView(
                    glowColor: .blue,
                    glowIntensity: 0.6
                ) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Health Battery")
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        Text("85%")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(.blue)
                        
                        Text("Optimal")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                
                // MARK: - Card with Icon
                IconGlassmorphismCard(
                    icon: "heart.fill",
                    label: "Heart Rate",
                    value: "72 BPM",
                    glowColor: .red,
                    systemImage: true
                )
                
                // MARK: - Centered Card
                CenteredGlassmorphismCard(
                    content: {
                        VStack(spacing: 12) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .font(.system(size: 32))
                                .foregroundColor(.orange)
                            
                            Text("Low Battery")
                                .font(.headline)
                                .foregroundColor(.white)
                            
                            Text("Activate shield to restore energy")
                                .font(.caption)
                                .foregroundColor(.gray)
                                .multilineTextAlignment(.center)
                        }
                    },
                    glowColor: .orange
                )
                
                Spacer()
            }
            .padding(16)
        }
        .preferredColorScheme(.dark)
    }
}
