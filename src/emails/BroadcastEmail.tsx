import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
} from "@react-email/components"
import { render } from "@react-email/components"

interface BroadcastEmailProps {
  subject: string
  body: string
  fromName: string
}

export default function BroadcastEmail({ subject, body, fromName }: BroadcastEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: "#f6f9fc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <Container style={{ backgroundColor: "#ffffff", margin: "40px auto", padding: "40px", borderRadius: "8px", maxWidth: "560px" }}>
          <Text style={{ fontSize: "14px", color: "#666666", marginBottom: "4px" }}>
            Message from your landlord
          </Text>
          <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#1a1a1a", marginBottom: "8px" }}>
            {subject}
          </Text>
          <Hr style={{ borderColor: "#e6e6e6", margin: "16px 0" }} />
          <Section>
            {body.split("\n").map((line, i) => (
              <Text key={i} style={{ fontSize: "16px", color: "#333333", lineHeight: "24px", margin: "4px 0" }}>
                {line || "\u00A0"}
              </Text>
            ))}
          </Section>
          <Hr style={{ borderColor: "#e6e6e6", margin: "24px 0" }} />
          <Text style={{ fontSize: "12px", color: "#999999", textAlign: "center" }}>
            This message was sent via RentalMgmt by {fromName}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export async function renderBroadcastEmail(props: BroadcastEmailProps): Promise<string> {
  return render(<BroadcastEmail {...props} />)
}
