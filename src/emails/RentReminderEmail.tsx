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

interface RentReminderEmailProps {
  tenantName: string
  unitNumber: string
  rentAmount: string        // formatted like "$1,500.00"
  reminderType: "upcoming" | "due_today" | "overdue_1" | "overdue_3" | "overdue_7"
  dueDay: number
}

function getSubjectLine(reminderType: RentReminderEmailProps["reminderType"]): string {
  switch (reminderType) {
    case "upcoming": return "Rent Payment Reminder"
    case "due_today": return "Rent Payment Due Today"
    case "overdue_1": return "Rent Payment Overdue"
    case "overdue_3": return "Rent Payment 3 Days Overdue"
    case "overdue_7": return "Urgent: Rent Payment 7 Days Overdue"
  }
}

function getMessage(props: RentReminderEmailProps): string {
  const { rentAmount, unitNumber, dueDay, reminderType } = props
  switch (reminderType) {
    case "upcoming":
      return `Your rent of ${rentAmount} for Unit ${unitNumber} is due on the ${dueDay}${getOrdinal(dueDay)} of this month.`
    case "due_today":
      return `Your rent of ${rentAmount} for Unit ${unitNumber} is due today.`
    case "overdue_1":
      return `Your rent of ${rentAmount} for Unit ${unitNumber} was due yesterday. Please submit payment at your earliest convenience.`
    case "overdue_3":
      return `Your rent of ${rentAmount} for Unit ${unitNumber} is 3 days past due. Please submit payment as soon as possible.`
    case "overdue_7":
      return `Your rent of ${rentAmount} for Unit ${unitNumber} is 7 days past due. Immediate attention is required.`
  }
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

export default function RentReminderEmail(props: RentReminderEmailProps) {
  const { tenantName, reminderType, rentAmount } = props
  const message = getMessage(props)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const isOverdue = reminderType.startsWith("overdue")

  return (
    <Html>
      <Head />
      <Preview>{getSubjectLine(reminderType)}</Preview>
      <Body style={{ backgroundColor: "#f6f9fc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <Container style={{ backgroundColor: "#ffffff", margin: "40px auto", padding: "40px", borderRadius: "8px", maxWidth: "560px" }}>
          <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#1a1a1a", marginBottom: "8px" }}>
            {getSubjectLine(reminderType)}
          </Text>
          <Hr style={{ borderColor: "#e6e6e6", margin: "16px 0" }} />
          <Text style={{ fontSize: "16px", color: "#333333", lineHeight: "24px" }}>
            Hi {tenantName},
          </Text>
          <Text style={{ fontSize: "16px", color: "#333333", lineHeight: "24px" }}>
            {message}
          </Text>
          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Text style={{ fontSize: "28px", fontWeight: "bold", color: isOverdue ? "#dc2626" : "#2563eb" }}>
              {rentAmount}
            </Text>
          </Section>
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
              Pay Now
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

export async function renderRentReminderEmail(props: RentReminderEmailProps): Promise<string> {
  return render(<RentReminderEmail {...props} />)
}
