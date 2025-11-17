# Privacy Policy for Koi Pond New Tab

**Last Updated:** November 17, 2025

## Overview

Koi Pond New Tab is committed to protecting your privacy. This extension operates entirely locally on your device and does not collect, store, or transmit any personal information to external servers controlled by the developer.

## Data Collection and Usage

### Weather Feature (Optional)

When you enable the Weather widget, the extension:

- **Geolocation Permission**: May request your approximate location using the browser's geolocation API to provide local weather information
- **Weather Data**: Fetches weather data from Open-Meteo API (https://open-meteo.com), a free and open weather service
- **No Personal Data Transmitted**: Only geographic coordinates (latitude/longitude) are sent to Open-Meteo to retrieve weather information. No identifying information is transmitted.
- **Manual Location**: You can alternatively enter a location manually, eliminating the need for geolocation permission

### Local Storage

The extension uses Chrome's local storage API to save your preferences, including:
- Number of koi fish and lily pads
- Widget visibility and positions
- Custom quotes and settings
- Weather preferences and last known location
- Time format and timezone preferences
- Background customization settings

**All settings are stored locally on your device and are never transmitted to any external server.**

### External API Usage

The extension connects to the following third-party services:

1. **Open-Meteo API** (https://api.open-meteo.com)
   - Purpose: Retrieve weather data
   - Data Sent: Geographic coordinates only (when weather widget is enabled)
   - Privacy Policy: https://open-meteo.com/en/terms

2. **Open-Meteo Geocoding API** (https://geocoding-api.open-meteo.com)
   - Purpose: Convert location names to coordinates
   - Data Sent: Location name (when manually entered)
   - Privacy Policy: https://open-meteo.com/en/terms

### Google Search Integration

The optional search widget redirects searches to Google in your current tab. The extension itself does not collect or process any search queries. All data handling is subject to Google's privacy policy.

## Permissions Explanation

- **storage**: Used to save your extension settings locally on your device
- **geolocation**: Used only for the weather feature (optional) to determine your approximate location
- **host_permissions** (api.open-meteo.com): Required to fetch weather data from the Open-Meteo API

## Data Sharing

**We do not share, sell, or distribute any user data.** The extension developer has no access to your data, as everything is stored locally on your device.

## Third-Party Services

This extension relies on Open-Meteo, an independent third-party weather service. We have no control over and assume no responsibility for the content, privacy policies, or practices of Open-Meteo. We encourage you to review their privacy policy.

## Children's Privacy

This extension does not knowingly collect any personal information from children under the age of 13. The extension does not collect personal information from users of any age.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Any changes will be reflected in the extension's repository and documentation. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Contact

For questions or concerns about this privacy policy, please open an issue on the GitHub repository:
https://github.com/Water6446/Koi-Pond

## Your Consent

By using Koi Pond New Tab, you consent to this privacy policy.

---

**Summary:** This extension prioritizes your privacy. Your data stays on your device. The only external communication is optional weather data fetching from Open-Meteo using only geographic coordinates.
