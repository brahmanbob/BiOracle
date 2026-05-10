import SwiftUI

// MARK: - Health Battery View
/// Main view displaying device health/battery status with animations and haptic feedback
struct HealthBatteryView: View {
    @State private var batteryLevel: Double = 35 // Below 50% to show pulsing button
    @State private var isCharging = false
    @State private var lastUpdateTime = "2:45 PM"
    
    var batteryStatus: String {
        switch batteryLevel {
        case 75...100:
            return "Excellent"
        case 50..<75:
            return "Good"
        case 25..<50:
            return "Low"
        default:
            return "Critical"
        }
    }
    
    var statusColor: Color {
        switch batteryLevel {
        case 75...100:
            return .green
        case 50..<75:
            return .blue
        case 25..<50:
            return .orange
        default:
            return .red
        }
    }
    
    var body: some View {
        ZStack {
            // MARK: - Background Gradient
            LinearGradient(
                gradient: Gradient(colors: [
                    Color.blue.opacity(0.1),
                    Color.purple.opacity(0.1)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack(spacing: 20) {
                // MARK: - Header
                VStack(alignment: .leading, spacing: 8) {
                    Text("Health Battery")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                    
                    Text("Last updated: \(lastUpdateTime)")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .fadeIn(duration: 0.4, delay: 0)
                
                ScrollView {
                    VStack(spacing: 16) {
                        // MARK: - Main Battery Circle
                        GlassmorphismCardView(
                            glowColor: statusColor,
                            glowIntensity: 0.7,
                            cornerRadius: 24
                        ) {
                            VStack(spacing: 20) {
                                ZStack {
                                    // Background circle
                                    Circle()
                                        .stroke(
                                            Color.white.opacity(0.1),
                                            lineWidth: 12
                                        )
                                    
                                    // Progress circle
                                    Circle()
                                        .trim(from: 0, to: batteryLevel / 100)
                                        .stroke(
                                            LinearGradient(
                                                gradient: Gradient(colors: [
                                                    statusColor,
                                                    statusColor.opacity(0.7)
                                                ]),
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                   // This hooks the Microphone to the Battery
const startGutScan = async () => {
  // 1. Activate S21 Microphone
  // 2. Run StomachEngine.ts logic
  // 3. If "Lectin Alert" is found...
  // 4. Drop Battery from 88% to 42% + Turn it RED.
};
                         ),
                                            style: StrokeStyle(
                                                lineWidth: 12,
                                                lineCap: .round
                                            )
                                        )
                                        .rotationEffect(.degrees(-90))
                                        .animation(.easeInOut(duration: 1.0), value: batteryLevel)
                                    
                                    // Center content
                                    VStack(spacing: 8) {
                                        Text("\(Int(batteryLevel))%")
                                            .font(.system(size: 48, weight: .bold))
                                            .foregroundColor(statusColor)
                                        
                                        Text(batteryStatus)
                                            .font(.headline)
                                            .foregroundColor(.white)
                                    }
                                }
                                .frame(height: 200)
                                
                                // Charging indicator
                                if isCharging {
                                    HStack(spacing: 4) {
                                        Image(systemName: "bolt.fill")
                                            .font(.caption2)
                                        Text("Charging...")
                                            .font(.caption)
                                    }
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(Color.green.opacity(0.2))
                                    .cornerRadius(8)
                                    .foregroundColor(.green)
                                    .fadeIn(duration: 0.5, delay: 0.2)
                                }
                            }
                            .padding(20)
                        }
                        .fadeIn(duration: 0.5, delay: 0.1)
                        
                        // MARK: - Low Battery Warning (conditional)
                        if batteryLevel < 50 {
                            GlassmorphismCardView(
                                glowColor: .orange,
                                glowIntensity: 0.7,
                                cornerRadius: 16
                            ) {
                                HStack(spacing: 12) {
                                    Image(systemName: "exclamationmark.circle.fill")
                                        .font(.title3)
                                        .foregroundColor(.orange)
                                    
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Low Battery Alert")
                                            .font(.headline)
                                            .foregroundColor(.white)
                                        
                                        Text("Activate Faraday Shield to restore energy")
                                            .font(.caption)
                                            .foregroundColor(.gray)
                                    }
                                    
                                    Spacer()
                                }
                                .padding(12)
                            }
                            .fadeIn(duration: 0.6, delay: 0.3)
                        }
                        
                        // MARK: - Action Button (Pulsing)
                        Button(action: {
                            HapticManager.triggerMediumHaptic()
                            activateFaradayShield()
                        }) {
                            HStack(spacing: 8) {
                                Image(systemName: "shield.fill")
                                Text("Activate Faraday Shield")
                                Spacer()
                                if batteryLevel < 50 {
                                    Image(systemName: "lightning.fill")
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(14)
                            .background(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color.blue,
                                        Color.blue.opacity(0.8)
                                    ]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .foregroundColor(.white)
                            .fontWeight(.semibold)
                            .cornerRadius(12)
                        }
                        .pulse(when: batteryLevel < 50, intensity: 0.25)
                        .fadeIn(duration: 0.6, delay: 0.4)
                        
                        // MARK: - Metrics Grid
                        VStack(spacing: 12) {
                            HStack(spacing: 12) {
                                MetricCard(
                                    icon: "heart.fill",
                                    label: "Heart Rate",
                                    value: "72 BPM",
                                    glowColor: .red
                                )
                                .fadeIn(duration: 0.5, delay: 0.5)
                                
                                MetricCard(
                                    icon: "thermometer",
                                    label: "Temperature",
                                    value: "37.2°C",
                                    glowColor: .orange
                                )
                                .fadeIn(duration: 0.5, delay: 0.6)
                            }
                            
                            HStack(spacing: 12) {
                                MetricCard(
                                    icon: "lungs.fill",
                                    label: "O₂ Level",
                                    value: "98%",
                                    glowColor: .cyan
                                )
                                .fadeIn(duration: 0.5, delay: 0.7)
                                
                                MetricCard(
                                    icon: "brain.head.profile",
                                    label: "Stress",
                                    value: "Low",
                                    glowColor: .green
                                )
                                .fadeIn(duration: 0.5, delay: 0.8)
                            }
                        }
                        
                        // MARK: - Test Controls (for demo)
                        VStack(spacing: 12) {
                            Divider()
                                .padding(.vertical, 8)
                            
                            Text("Demo Controls")
                                .font(.caption2)
                                .fontWeight(.semibold)
                                .foregroundColor(.gray)
                            
                            HStack(spacing: 12) {
                                Button(action: {
                                    batteryLevel = max(0, batteryLevel - 10)
                                    HapticManager.triggerLightHaptic()
                                }) {
                                    Text("- Battery")
                                        .font(.caption2)
                                        .frame(maxWidth: .infinity)
                                        .padding(8)
                                        .background(Color.red.opacity(0.2))
                                        .cornerRadius(6)
                                }
                                
                                Button(action: {
                                    batteryLevel = min(100, batteryLevel + 10)
                                    HapticManager.triggerLightHaptic()
                                }) {
                                    Text("+ Battery")
                                        .font(.caption2)
                                        .frame(maxWidth: .infinity)
                                        .padding(8)
                                        .background(Color.green.opacity(0.2))
                                        .cornerRadius(6)
                                }
                            }
                            
                            Button(action: {
                                isCharging.toggle()
                                HapticManager.triggerSelectionHaptic()
                            }) {
                                Text(isCharging ? "Stop Charging" : "Start Charging")
                                    .font(.caption2)
                                    .frame(maxWidth: .infinity)
                                    .padding(8)
                                    .background(Color.blue.opacity(0.2))
                                    .cornerRadius(6)
                            }
                        }
                        .padding(.top, 12)
                    }
                    .padding(16)
                }
            }
            .screenTransition(duration: 0.5)
        }
        .preferredColorScheme(.dark)
    }
    
    // MARK: - Action Methods
    private func activateFaradayShield() {
        withAnimation(.easeInOut(duration: 0.5)) {
            batteryLevel = min(100, batteryLevel + 20)
            isCharging = true
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            withAnimation {
                isCharging = false
            }
        }
    }
}

// MARK: - Metric Card Component
struct MetricCard: View {
    let icon: String
    let label: String
    let value: String
    let glowColor: Color
    
    var body: some View {
        GlassmorphismCardView(
            glowColor: glowColor,
            glowIntensity: 0.6,
            cornerRadius: 14
        ) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: icon)
                        .font(.caption)
                        .foregroundColor(glowColor)
                    
                    Text(label)
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                
                Text(value)
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
        }
    }
}

// MARK: - Preview
struct HealthBatteryView_Previews: PreviewProvider {
    static var previews: some View {
        HealthBatteryView()
    }
}
