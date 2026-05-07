# BiOracle Dependencies Quick Reference

## iOS Native Frameworks (Included in SDK)

### SwiftUI
- **Version**: iOS 15.0+
- **Status**: ✅ Required
- **Usage**: UI Components, Animations, Modifiers
- **Import**: `import SwiftUI`

### UIKit
- **Version**: iOS 13.0+
- **Status**: ✅ Required
- **Usage**: Haptic Feedback, Blur Effects, Audio Session
- **Import**: `import UIKit`

### AVFoundation
- **Version**: iOS 13.0+
- **Status**: ✅ Required
- **Usage**: Audio Engine, Frequency Generation, Playback
- **Import**: `import AVFoundation`

### CoreMotion
- **Version**: iOS 13.0+
- **Status**: ⚠️ Optional (for motion tracking)
- **Usage**: Accelerometer, Gyroscope, Step Counter
- **Import**: `import CoreMotion`

### HealthKit
- **Version**: iOS 13.0+
- **Status**: ⚠️ Optional (for health integration)
- **Usage**: Heart Rate, O2, Temperature, Sleep Data
- **Import**: `import HealthKit`

### CoreBluetooth
- **Version**: iOS 13.0+
- **Status**: ⚠️ Optional (for BLE sensors)
- **Usage**: Connect to biometric devices
- **Import**: `import CoreBluetooth`

### UserNotifications
- **Version**: iOS 13.0+
- **Status**: ⚠️ Optional (for alerts)
- **Usage**: Local notifications, alerts
- **Import**: `import UserNotifications`

### CryptoKit
- **Version**: iOS 13.0+
- **Status**: ✅ Required (for encryption)
- **Usage**: AES-256-GCM, SHA-256, HMAC
- **Import**: `import CryptoKit`

### LocalAuthentication
- **Version**: iOS 13.0+
- **Status**: ✅ Required (for biometric auth)
- **Usage**: Face ID, Touch ID authentication
- **Import**: `import LocalAuthentication`

---

## Expo/React Native Dependencies (If Cross-Platform)

### expo-av
```bash
expo install expo-av
```
- **Purpose**: Audio/Video playback (cross-platform)
- **Alternative**: AVFoundation (iOS-only)
- **API**: `Audio.Sound`, `Audio.SoundObject`

### expo-haptics
```bash
expo install expo-haptics
```
- **Purpose**: Haptic feedback (iOS + Android)
- **Alternative**: UIKit haptics (iOS-only)
- **API**: `Haptics.impactAsync()`, `Haptics.notificationAsync()`

### expo-permissions
```bash
expo install expo-permissions
```
- **Purpose**: Request app permissions
- **Permissions**: CAMERA, LOCATION, HEALTH_KIT, BLUETOOTH

---

## Installation Matrix

| Framework | Native? | Expo? | Required? |
|-----------|---------|-------|----------|
| SwiftUI | ✅ | ❌ | ✅ |
| UIKit | ✅ | ❌ | ✅ |
| AVFoundation | ✅ | ⚠️ | ✅ |
| CryptoKit | ✅ | ❌ | ✅ |
| LocalAuthentication | ✅ | ❌ | ✅ |
| CoreBluetooth | ✅ | ❌ | ⚠️ |
| HealthKit | ✅ | ❌ | ⚠️ |
| expo-av | ❌ | ✅ | ⚠️ |
| expo-haptics | ❌ | ✅ | ⚠️ |

