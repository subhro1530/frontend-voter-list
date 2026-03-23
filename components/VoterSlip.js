import { forwardRef, useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getVoterLocationData } from "../lib/gemini";
import { resolveVoterPhoto } from "../lib/photoAdapter";

// Get frontend URL from environment
const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  "https://frontend-voter-list.vercel.app";

// Voter Slip Component - Matches Election Commission of India format exactly
const VoterSlip = forwardRef(function VoterSlip({ voter, showQR = true }, ref) {
  const [locationData, setLocationData] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Generate voter verification URL
  const voterVerificationUrl = voter?.id
    ? `${FRONTEND_URL}/voter/${voter.id}`
    : `${FRONTEND_URL}/voter/${voter?.voter_id || "unknown"}`;

  // Auto-fill location data using Gemini API
  useEffect(() => {
    if (!voter) return;

    console.log(
      "VoterSlip: Checking if location data needed for voter:",
      voter.voter_id,
    );

    // Check if we need to fetch location data
    const needsState = !voter.state;
    const needsDistrict = !voter.district;
    const needsPollingStation = !voter.polling_station;

    console.log(
      "VoterSlip: Needs - state:",
      needsState,
      "district:",
      needsDistrict,
      "polling:",
      needsPollingStation,
    );

    if (needsState || needsDistrict || needsPollingStation) {
      console.log("VoterSlip: Fetching location data...");
      setLoadingLocation(true);
      getVoterLocationData(voter)
        .then((data) => {
          console.log("VoterSlip: Received location data:", data);
          if (data) {
            setLocationData(data);
          }
        })
        .catch((err) => {
          console.error("VoterSlip: Error fetching location:", err);
        })
        .finally(() => setLoadingLocation(false));
    }
  }, [voter?.voter_id]); // Use voter_id as dependency for stable reference

  if (!voter) return null;

  // Get display values - use API data if voter data is missing
  const displayState = voter.state || locationData?.state || "—";
  const displayDistrict = voter.district || locationData?.district || "—";
  const displayPollingStation =
    voter.polling_station || locationData?.pollingStation || "—";

  console.log("VoterSlip: Display values -", {
    displayState,
    displayDistrict,
    displayPollingStation,
  });

  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div ref={ref} className="voter-slip-wrapper">
      <div className="voter-slip">
        {/* Header - Election Commission with India flag gradient */}
        <div className="slip-header">
          <div className="slip-header-content">
            <div className="emblem-container">
              <img
                src="/images/emblem.png"
                alt="National Emblem"
                className="emblem-img"
              />
            </div>
            <div className="slip-title-section">
              <h1 className="slip-main-title">ELECTION COMMISSION OF INDIA</h1>
              <h2 className="slip-main-title-hindi">भारत निर्वाचन आयोग</h2>
              <div className="slip-election-info">
                <span className="election-type">Vidhan Sabha Elections</span>
                <span className="election-divider">|</span>
                <span className="election-type-hindi">विधान सभा निर्वाचन</span>
              </div>
              <div className="slip-subtitle-container">
                <span className="slip-subtitle">Voter Information Slip</span>
              </div>
            </div>
            <div className="emblem-container">
              <img
                src="/images/eci-logo.png"
                alt="ECI Logo"
                className="emblem-img"
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="slip-body">
          {/* Left Section - QR Code & Photo */}
          <div className="slip-left">
            {showQR && (
              <div className="qr-section">
                <div className="qr-code">
                  <QRCodeSVG
                    value={voterVerificationUrl}
                    size={96}
                    level="M"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#1a365d"
                  />
                </div>
                <p className="qr-scan-text">Scan to verify</p>
              </div>
            )}
            <div className="voter-photo-section">
              <VoterImage voter={voter} size="slip" />
            </div>
            <div className="poll-date-section">
              <div className="poll-date-row">
                <span className="poll-label">Date of Poll:</span>
                <span className="poll-date">{currentDate}</span>
              </div>
              <div className="poll-timing">
                <span className="timing-label">Timings:</span>
                <div className="timing-details">
                  <span>Morning 08:00 AM to Evening 05:00 PM</span>
                  <span className="timing-hindi">
                    सुबह 08:00 AM शाम 05:00 PM
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Voter Details Table */}
          <div className="slip-right">
            <table className="slip-table">
              <tbody>
                <SlipRow
                  label="State"
                  labelHindi="राज्य"
                  value={loadingLocation ? "Loading..." : displayState}
                  loading={loadingLocation && !voter.state}
                />
                <SlipRow
                  label="Assembly Constituency"
                  labelHindi="विधान सभा निर्वाचन क्षेत्र"
                  value={voter.assembly || "—"}
                />
                <SlipRow
                  label="Name"
                  labelHindi="नाम"
                  value={voter.name || "—"}
                />
                <SlipRow
                  label="Gender"
                  labelHindi="लिंग"
                  value={voter.gender || "—"}
                  capitalize
                />
                <SlipRow
                  label="EPIC No."
                  labelHindi="ईपीआईसी नं."
                  value={voter.voter_id || "—"}
                  highlight
                />
                <SlipRow
                  label="Father's Name"
                  labelHindi="पिता का नाम"
                  value={voter.relation_name || "—"}
                />
                <SlipRow
                  label="Part No."
                  labelHindi="भाग सं."
                  value={voter.part_number || "—"}
                />
                <SlipRow
                  label="Part Name"
                  labelHindi="भाग का नाम"
                  value={voter.section || "—"}
                />
                <SlipRow
                  label="Serial No."
                  labelHindi="क्रम सं."
                  value={voter.serial_number || "—"}
                  highlight
                />
                <SlipRow
                  label="Polling Station"
                  labelHindi="मतदान केंद्र"
                  value={loadingLocation ? "Loading..." : displayPollingStation}
                  loading={loadingLocation && !voter.polling_station}
                />
              </tbody>
            </table>

            {/* CEO Website Info */}
            <div className="ceo-info">
              <div className="ceo-row">
                <span className="ceo-label">CEO WEBSITE:</span>
                <span className="ceo-value">ceohimachal.nic.in</span>
              </div>
              <div className="ceo-row">
                <span className="ceo-label">
                  CEO Call Center Toll Free No.:
                </span>
                <span className="ceo-value">1800221950</span>
              </div>
              <div className="ceo-row">
                <span className="ceo-label">DISTRICT ELECTION OFFICE:</span>
                <span className="ceo-value">
                  {loadingLocation ? "Loading..." : displayDistrict}
                </span>
              </div>
              <div className="ceo-row">
                <span className="ceo-label">DEO Helpline No.:</span>
                <span className="ceo-value">1950</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Warning */}
        <div className="slip-footer">
          <div className="slip-warning">
            <p className="warning-text">
              This will not be accepted as an Identification document for
              voting.
            </p>
            <p className="warning-text-hindi">
              इसे मतदान के लिए पहचान पत्र के रूप में स्वीकार नहीं किया जाएगा।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

// Slip table row component
function SlipRow({ label, labelHindi, value, highlight, capitalize, loading }) {
  return (
    <tr className="slip-row">
      <td className="slip-label-cell">
        <div className="slip-label">{label}</div>
        <div className="slip-label-hindi">{labelHindi}</div>
      </td>
      <td className="slip-separator">:</td>
      <td
        className={`slip-value-cell ${highlight ? "slip-value-highlight" : ""} ${
          capitalize ? "capitalize" : ""
        } ${loading ? "slip-value-loading" : ""}`}
      >
        {loading ? (
          <span className="slip-loading-text">
            <span className="slip-loading-dot">●</span> Auto-filling...
          </span>
        ) : (
          value
        )}
      </td>
    </tr>
  );
}

// Voter Image Component - Reusable across the app
export function VoterImage({
  voter,
  size = "medium",
  showBorder = true,
  className = "",
}) {
  const sizeClasses = {
    small: "voter-image-small",
    medium: "voter-image-medium",
    large: "voter-image-large",
    xlarge: "voter-image-xlarge",
    slip: "voter-image-slip",
  };

  const resolvedPhotoUrl = resolveVoterPhoto(voter?.photo_url);
  const hasImage = Boolean(
    voter?.photo_url && !String(voter?.photo_url).startsWith("placeholder://"),
  );

  return (
    <div
      className={`voter-image ${sizeClasses[size]} ${showBorder ? "voter-image-bordered" : ""} ${className}`}
      title={voter?.name || "Voter"}
    >
      {hasImage ? (
        <img
          src={resolvedPhotoUrl}
          alt={voter.name || "Voter"}
          className="voter-image-photo"
          onError={(e) => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />
      ) : null}
      <div
        className="voter-image-placeholder"
        style={{ display: hasImage ? "none" : "flex" }}
      >
        <img
          src="/images/voter-placeholder.png"
          alt="User"
          className="voter-placeholder-img"
        />
      </div>
    </div>
  );
}

// Voter Card Preview Component for lists
export function VoterCardPreview({ voter, onClick, showActions = true }) {
  if (!voter) return null;

  return (
    <div
      className="voter-card-preview"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      <div className="voter-card-left">
        <VoterImage voter={voter} size="medium" />
        <div className="voter-card-info">
          <h4 className="voter-card-name">{voter.name || "—"}</h4>
          <p className="voter-card-id">{voter.voter_id || "—"}</p>
          <div className="voter-card-meta">
            <span className="voter-card-age">{voter.age || "—"} yrs</span>
            <span className="voter-card-divider">•</span>
            <span className="voter-card-gender capitalize">
              {voter.gender || "—"}
            </span>
          </div>
        </div>
      </div>
      {showActions && (
        <div className="voter-card-actions">
          <span className="voter-card-action-icon">→</span>
        </div>
      )}
    </div>
  );
}

export default VoterSlip;
