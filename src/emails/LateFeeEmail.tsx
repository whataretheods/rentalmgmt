import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
  Link,
} from "@react-email/components"
import { render } from "@react-email/components"

interface LateFeeEmailProps {
  tenantName: string
  unitNumber: string
  feeAmount: string       // formatted like "$50.00"
  rentAmount: string      // formatted like "$1,500.00"
  billingPeriod: string   // "2026-03" format
  gracePeriodDays: number
}

export default function LateFeeEmail(props: LateFeeEmailProps) {
  const { tenantName, unitNumber, feeAmount, rentAmount, billingPeriod, gracePeriodDays } = props
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return (
    <Html>
      <Head />
      <Preview>Late Fee Posted — Unit {unitNumber}</Preview>
      <Body style={{ backgroundColor: "#f6f9fc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <Container style={{ backgroundColor: "#ffffff", margin: "40px auto", padding: "40px", borderRadius: "8px", maxWidth: "560px" }}>
          <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#1a1a1a", marginBottom: "8px" }}>
            Late Fee Posted
          </Text>
          <Hr style={{ borderColor: "#e6e6e6", margin: "16px 0" }} />
          <Text style={{ fontSize: "16px", color: "#333333", lineHeight: "24px" }}>
            Hi {tenantName},
          </Text>
          <Text style={{ fontSize: "16px", color: "#333333", lineHeight: "24px" }}>
            A late fee of {feeAmount} has been posted to your account for Unit {unitNumber}. Your rent of {rentAmount} for {billingPeriod} was not received within the {gracePeriodDays}-day grace period.
          </Text>
          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Text style={{ fontSize: "28px", fontWeight: "bold", color: "#dc2626" }}>
              {feeAmount}
            </Text>
            <Text style={{ fontSize: "14px", color: "#666666" }}>
              Late fee added to your balance
            </Text>
          </Section>
          <Text style={{ fontSize: "16px", color: "#333333", lineHeight: "24px" }}>
            Please log in to your portal to view your updated balance and make a payment.
          </Text>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Link
              href={`${appUrl}/tenant/dashboard`}
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
                padding: "12px 32px",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: "500",
              }}
            >
              View Balance & Pay
            </Link>
          </Section>
          <Hr style={{ borderColor: "#e6e6e6", margin: "24px 0" }} />
          <Text style={{ fontSize: "12px", color: "#999999", textAlign: "center" }}>
            This is an automated message from RentalMgmt.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export async function renderLateFeeEmail(props: LateFeeEmailProps): Promise<string> {
  return render(<LateFeeEmail {...props} />)
}
