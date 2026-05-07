import SwiftUI

// MARK: - Haptic Feedback Implementation Examples

/// Example view demonstrating various haptic feedback implementations
struct HapticFeedbackExampleView: View {
    @State private var selectedHaptic = "medium"
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Haptic Feedback Examples")
                .font(.title)
                .fontWeight(.bold)
            
            // MARK: - Light Haptic Button
            Button(action: {
                HapticManager.triggerLightHaptic()
            }) {
                HStack {
                    Image(systemName: "hand.tap")
                    Text("Light Haptic")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue.opacity(0.2))
                .cornerRadius(10)
            }
            
            // MARK: - Medium Haptic Button
            Button(action: {
                HapticManager.triggerMediumHaptic()
            }) {
                HStack {
                    Image(systemName: "hand.thumbsup")
                    Text("Medium Haptic")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.green.opacity(0.2))
                .cornerRadius(10)
            }
            
            // MARK: - Heavy Haptic Button
            Button(action: {
                HapticManager.triggerHeavyHaptic()
            }) {
                HStack {
                    Image(systemName: "exclamationmark.circle")
                    Text("Heavy Haptic")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.red.opacity(0.2))
                .cornerRadius(10)
            }
            
            // MARK: - Selection Haptic Button
            Button(action: {
                HapticManager.triggerSelectionHaptic()
            }) {
                HStack {
                    Image(systemName: "checkmark.circle")
                    Text("Selection Haptic")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.purple.opacity(0.2))
                .cornerRadius(10)
            }
            
            Divider()
                .padding(.vertical, 10)
            
            // MARK: - Notification Haptics
            VStack(spacing: 12) {
                Text("Notification Feedback")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                HStack(spacing: 12) {
                    Button(action: {
                        HapticManager.triggerSuccess()
                    }) {
                        Text("✓ Success")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.green.opacity(0.3))
                            .cornerRadius(8)
                    }
                    
                    Button(action: {
                        HapticManager.triggerWarning()
                    }) {
                        Text("⚠ Warning")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.orange.opacity(0.3))
                            .cornerRadius(8)
                    }
                    
                    Button(action: {
                        HapticManager.triggerError()
                    }) {
                        Text("✕ Error")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.red.opacity(0.3))
                            .cornerRadius(8)
                    }
                }
            }
            
            Spacer()
            
            // MARK: - Usage Notes
            VStack(alignment: .leading, spacing: 8) {
                Text("Usage Guidelines")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.gray)
                
                BulletPoint(text: "Light: Tab navigation, subtle interactions")
                BulletPoint(text: "Medium: Button presses, important actions")
                BulletPoint(text: "Heavy: Confirmations, critical decisions")
                BulletPoint(text: "Selection: Picker/value changes")
                BulletPoint(text: "Note: Requires physical device (simulator may not work)")
            }
            .font(.caption2)
            .foregroundColor(.gray)
        }
        .padding()
    }
}

// MARK: - Bullet Point Helper
struct BulletPoint: View {
    let text: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text("•")
                .foregroundColor(.blue)
            Text(text)
        }
    }
}

// MARK: - Medium Haptic Integration in Button
struct MediumHapticButton: View {
    let title: String
    let action: () -> Void
    
    var body: some View {
        Button(action: {
            HapticManager.triggerMediumHaptic()
            action()
        }) {
            Text(title)
                .frame(maxWidth: .infinity)
                .padding(12)
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(8)
        }
    }
}

// MARK: - Preview
struct HapticFeedbackExample_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            HapticFeedbackExampleView()
                .navigationTitle("Haptics Demo")
        }
        .preferredColorScheme(.dark)
    }
}
