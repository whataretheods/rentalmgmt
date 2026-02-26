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

interface AutopayChargeEmailProps {
  tenantName: string
  unitNumber: string
  rentAmount: string
  feeAmount: string
  totalAmount: string
  chargeDate: string
  paymentMethodLabel: string
}

export default function AutopayChargeEmail(props: AutopayChargeEmailProps) {
  const {
    tenantName,
    unitNumber,
    rentAmount,
    feeAmount,
    totalAmount,
    chargeDate,
    paymentMethodLabel,
  } = props
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return (
    <Html>
      <Head />
      <Preview>Autopay charge of {totalAmount} on {chargeDate}</Preview>
      <Body style={{ backgroundColor: "#f6f9fc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <Container style={{ backgroundColor: "#ffffff", margin: "40px auto", padding: "40px", borderRadius: "8px", maxWidth: "560px" }}>
          <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#1a1a1a", marginBottom: "8px" }}>
            Upcoming Autopay Charge
          </Text>
          <Hr style={{ borderColor: "#e6e6e6", margin: "16px 0" }} />
          <Text style={{ fontSize: "16px", color: "#333333", lineHeight: "24px" }}>
            Hi {tenantName},
          </Text>
          <Text style={{ fontSize: "16px", color: "#333333", lineHeight: "24px" }}>
            Your autopay charge of {totalAmount} ({rentAmount} rent + {feeAmount} processing fee) for Unit {unitNumber} will be processed on {chargeDate} using {paymentMethodLabel}.
          </Text>
          <Section style={{ backgroundColor: "#f8fafc", borderRadius: "6px", padding: "20px", margin: "24px 0" }}>
            <Text style={{ fontSize: "14px", color: "#666666", margin: "4px 0" }}>
              Rent: {rentAmount}
            </Text>
            <Text style={{ fontSize: "14px", color: "#666666", margin: "4px 0" }}>
              Processing fee: {feeAmount}
            </Text>
            <Hr style={{ borderColor: "#e6e6e6", margin: "8px 0" }} />
            <Text style={{ fontSize: "18px", fontWeight: "bold", color: "#1a1a1a", margin: "4px 0" }}>
              Total: {totalAmount}
            </Text>
            <Text style={{ fontSize: "14px", color: "#666666", margin: "4px 0" }}>
              Payment method: {paymentMethodLabel}
            </Text>
            <Text style={{ fontSize: "14px", color: "#666666", margin: "4px 0" }}>
              Charge date: {chargeDate}
            </Text>
          </Section>
          <Text style={{ fontSize: "14px", color: "#666666", lineHeight: "22px" }}>
            If you need to cancel autopay, visit your autopay settings before the charge date.
          </Text>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Link
              href={`${appUrl}/tenant/autopay`}
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
              Manage Autopay
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

export async function renderAutopayChargeEmail(props: AutopayChargeEmailProps): Promise<string> {
  return render(<AutopayChargeEmail {...props} />)
}
