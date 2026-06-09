import { User } from "../../../shared/entities/User";
import { emailService } from "../../../shared/services/email.service";
import { getEmailTemplateHtml } from "../../../shared/services/email-template";
import { getFrontendBaseUrl, joinFrontendUrl } from "../../../shared/services/utils";
import { SystemAdminInvitation } from "../entities/SystemAdminInvitation";

function getSystemAdminAppBaseUrl(): string {
  let baseUrl = getFrontendBaseUrl();
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}`;
  }
  try {
    const baseUrlObj = new URL(baseUrl);
    const host = baseUrlObj.hostname;
    baseUrlObj.hostname = host.startsWith("app.") ? host : `app.${host}`;
    return baseUrlObj.toString().replace(/\/$/, "");
  } catch {
    return baseUrl;
  }
}

function buildRegisterInviteUrl(invitation: SystemAdminInvitation): string {
  const appUrl = getSystemAdminAppBaseUrl();
  const params = new URLSearchParams({
    token: invitation.token,
    email: invitation.email,
    firstName: invitation.firstName || "",
    lastName: invitation.lastName || "",
  });
  return `${appUrl}/system-admin/register?${params.toString()}`;
}

export class SystemAdminInvitationEmailService {
  async sendInvitation(invitation: SystemAdminInvitation, inviter?: User): Promise<void> {
    const inviteUrl = buildRegisterInviteUrl(invitation);
    const inviterName = inviter?.lastName || "a WhitePenguin administrator";
    const inviteeFirstName = invitation.firstName?.trim();
    const inviteeLastName = invitation.lastName?.trim();
    const inviteeName =
      inviteeFirstName || inviteeLastName
        ? `${inviteeFirstName || ""} ${inviteeLastName || ""}`.trim()
        : "there";

    const bodyContent = `
      <p>You have been invited to join WhitePenguin as a <strong>system administrator</strong>.</p>
      <div style="text-align: center; margin: 24px 0 32px 0;">
        <a href="${inviteUrl}" style="background-color: #008080; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Accept Invitation &amp; Register</a>
      </div>
      <div style="background-color: #f0f9f9; border: 1px solid #008080; padding: 24px; border-radius: 12px; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #008080;">Your system administrator access</h3>
        <p style="margin: 8px 0;"><strong>Registration URL:</strong> <a href="${inviteUrl}" style="color: #008080;">${inviteUrl}</a></p>
        <p style="margin: 8px 0;"><strong>Username:</strong> ${invitation.email}</p>
      </div>
      <p>After registering, sign in at the system administrator portal to manage schools on the platform.</p>
      <p style="font-size: 14px; color: #666;">If you have questions, contact ${inviterName}.</p>
    `;

    const html = getEmailTemplateHtml({
      recipientName: inviteeName,
      welcomeTitle: "You've Been Invited as a WhitePenguin System Administrator",
      bodyContent,
      schoolName: "WhitePenguin",
    });

    const text = `You've been invited as a WhitePenguin system administrator.\n\nRegister: ${inviteUrl}\nUsername: ${invitation.email}`;

    await emailService.sendEmail({
      to: invitation.email,
      subject: "You've Been Invited as a WhitePenguin System Administrator",
      html,
      text,
    });
  }

  async sendWelcome(email: string, name: string): Promise<void> {
    const loginUrl = joinFrontendUrl("system-admin/login");
    const bodyContent = `
      <p>Hello ${name},</p>
      <p>You have successfully been added as a system administrator on WhitePenguin. You can now manage schools across the platform.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}" style="background-color: #008080; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Sign In</a>
      </div>
      <div style="background-color: #f0f9f9; border: 1px solid #008080; padding: 24px; border-radius: 12px; margin: 24px 0;">
        <p style="margin: 8px 0;"><strong>Portal URL:</strong> <a href="${loginUrl}" style="color: #008080;">${loginUrl}</a></p>
        <p style="margin: 8px 0;"><strong>Username:</strong> ${email}</p>
      </div>
      <p>Warm regards,<br/>The WhitePenguin Team</p>
    `;

    const html = getEmailTemplateHtml({
      recipientName: name,
      welcomeTitle: "Welcome, System Administrator",
      bodyContent,
      schoolName: "WhitePenguin",
    });

    const text = `Hello ${name},\n\nYou have successfully been added as a system administrator on WhitePenguin. Please sign in here: ${loginUrl}\n\nWarm regards,\nThe WhitePenguin Team`;

    await emailService.sendEmail({
      to: email,
      subject: "Welcome — WhitePenguin System Administrator",
      html,
      text,
    });
  }
}

export const systemAdminInvitationEmailService = new SystemAdminInvitationEmailService();
