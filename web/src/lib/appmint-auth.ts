// @ts-nocheck — vendored AppEngine connector (ported from base-app, kept as-is)
import { cookies, headers } from 'next/headers';
import { activeSession } from './active-session';
import { getAppEngineClient } from './appmint-client';
import { appmintEndpoints } from './appmint-endpoints';
import { redirect } from 'next/navigation';
import { getRequestInfo } from './activity-tracker';

/**
 * Authentication service for Appmint
 * Provides methods for user authentication operations like login, register,
 * forgot password, and reset password
 */
export class AppmintAuth {
  private appEngineClient = getAppEngineClient();

  /**
   * Find Customer by email
   * @param email User's email
   */
  async customerExist(email: string) {
    try {
      const { clientInfo } = await this.getClientInfo();
      return await this.appEngineClient.processRequest(
        appmintEndpoints.customer_exist.method,
        `${appmintEndpoints.customer_exist.path}/${encodeURIComponent(email)}`,
        null,
        null,
        null,
        clientInfo,
      );
    } catch (error) {
      console.error('Find customer by email error:', error);
      throw error;
    }
  }

  /**
   *  validate social login
   * @param socialdata
   */
  async validateSocialLogin(data) {
    try {
      const { clientInfo } = await this.getClientInfo();
      return await this.appEngineClient.processRequest(
        appmintEndpoints.customer_social_login.method,
        appmintEndpoints.customer_social_login.path,
        data,
        null,
        null,
        clientInfo,
      );
    } catch (error) {
      console.error('Find customer by email error:', error);
      throw error;
    }
  }

  /**
   * Login a user with email and password
   * @param email User's email
   * @param password User's password
   * @returns Promise with login response
   */
  async login(email: string, password: string) {
    try {
      const { clientInfo } = await this.getClientInfo();
      const data = {
        email,
        password,
      };
      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.login.method,
        appmintEndpoints.login.path,
        data,
        null,
        null,
        clientInfo,
      );
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Login a user with magic link
   * @param email User's email
   * @param token Magic link token
   * @returns Promise with login response
   */
  async loginWithMagicLink(email: string, token: string) {
    const { clientInfo } = await this.getClientInfo();
    return this.appEngineClient.processRequest(
      appmintEndpoints.login_magic_link_redirect.method,
      appmintEndpoints.login_magic_link_redirect.path,
      { token, email },
      null,
      null,
      clientInfo,
      false,
    );
  }
  /**
   * Register a new user
   * @param userData User registration data
   * @returns Promise with registration response
   */
  async register(userData: { email: string; password: string; firstName?: string; lastName?: string; phone?: string; [key: string]: any }) {
    try {
      const { clientInfo } = await this.getClientInfo();
      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.register.method,
        appmintEndpoints.register.path,
        userData,
        null,
        null,
        clientInfo,
      );

      return response;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Send a forgot password request
   * @param email User's email
   * @returns Promise with forgot password response
   */
  async forgotPassword(email: string, redirectUrl: string) {
    try {
      const { clientInfo } = await this.getClientInfo();
      // The endpoint is GET, so we pass the email as a query parameter
      const path = `${appmintEndpoints.forget_password.path}/${encodeURIComponent(email)}/${encodeURIComponent(redirectUrl)}`;
      const response = await this.appEngineClient.processRequest(appmintEndpoints.forget_password.method, path, null, null, null, clientInfo);
      return response;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  async sendMagicLink(email: string) {
    const { token, clientInfo } = await this.getClientInfo();

    try {
      const path = `${appmintEndpoints.login_magic_link.path}?email=${encodeURIComponent(email)}`;
      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.login_magic_link.method,
        path,
        null,
        token,
        null,
        clientInfo,
        false,
      );
      return response;
    } catch (error) {
      console.error('Send magic link error:', error);
      throw error;
    }
  }
  /**
   * Validate password reset token
   * @param email User's email
   * @param token Reset password token
   * @returns Promise with token validation response
   */
  async validatePasswordResetToken(email: string, token: string) {
    try {
      const { clientInfo } = await this.getClientInfo();
      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.validate_password_token.method,
        appmintEndpoints.validate_password_token.path,
        { email, token },
        null,
        null,
        clientInfo,
      );

      return response;
    } catch (error) {
      console.error('Token validation error:', error);
      throw error;
    }
  }

  /**
   * Reset user password with token
   * @param token Reset password token
   * @param password New password
   * @returns Promise with reset password response
   */
  async resetPassword(token: string, password: string) {
    try {
      const { clientInfo } = await this.getClientInfo();
      const data = {
        token,
        password,
      };
      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.reset_password.method,
        appmintEndpoints.reset_password.path,
        data,
        null,
        null,
        clientInfo,
      );
      return response;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  /**
   * Verify a two-factor / new device challenge code
   * @param challengeToken The challenge token from login response
   * @param code The 6-digit verification code
   * @param trustDevice Whether to trust this device for future logins
   * @returns Promise with verification response (contains token on success)
   */
  async verifyTwoFactor(challengeToken: string, code: string, trustDevice: boolean = true) {
    try {
      const { clientInfo } = await this.getClientInfo();
      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.security_challenge_verify.method,
        appmintEndpoints.security_challenge_verify.path,
        { challengeToken, code, trustDevice },
        null,
        null,
        clientInfo,
      );
      return response;
    } catch (error) {
      console.error('Two-factor verification error:', error);
      throw error;
    }
  }

  /**
   * Resend a two-factor verification code
   * @param challengeToken The challenge token from login response
   * @param method The delivery method (email, sms)
   * @returns Promise with resend response
   */
  async resendTwoFactorCode(challengeToken: string, method: string = 'email') {
    try {
      const { clientInfo } = await this.getClientInfo();
      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.security_challenge_send.method,
        appmintEndpoints.security_challenge_send.path,
        { challengeToken, method },
        null,
        null,
        clientInfo,
      );
      return response;
    } catch (error) {
      console.error('Resend two-factor code error:', error);
      throw error;
    }
  }

  /**
   * Refresh the user's authentication token
   * @param refreshToken The refresh token
   * @returns Promise with new tokens
   */
  async refreshToken(refreshToken: string) {
    try {
      const { clientInfo } = await this.getClientInfo();
      const data = {
        refreshToken,
      };

      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.refresh_token.method,
        appmintEndpoints.refresh_token.path,
        data,
        null,
        null,
        clientInfo,
      );

      return response;
    } catch (error) {
      console.error('Refresh token error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param userData User profile data to update
   * @param authToken User's authentication token
   * @returns Promise with update response
   */
  async updateProfile(userData: any, authToken: string) {
    try {
      const { clientInfo } = await this.getClientInfo();
      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.profile_update.method,
        appmintEndpoints.profile_update.path,
        userData,
        authToken,
        null,
        clientInfo,
      );

      return response;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }

  /**
   * Get user account data
   * @param authToken User's authentication token
   * @param shouldRedirect Whether to redirect if not authenticated (default: true)
   * @returns Promise with account data
   */
  async getAccountData(shouldRedirect: boolean = true) {
    const { token, clientInfo } = await this.getClientInfo();
    if (!token) {
      if (shouldRedirect) {
        redirect('/login');
      }
      return null;
    }
    try {
      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.client_data.method,
        appmintEndpoints.client_data.path,
        null,
        token,
        null,
        clientInfo,
        false, // isMultiPath
      );

      // If response is empty string or null, return empty object with at least customer info
      if (!response || response === '' || Object.keys(response).length === 0) {
        // Try to at least get the customer profile
        const profile = await this.appEngineClient.processRequest('get', 'client-data/profile', null, token, null, clientInfo, false);
        return { customer: profile, orders: [], reservations: [], tickets: [], notifications: [] };
      }

      return response;
    } catch (error: any) {
      console.error('Get account data error:', error);
      // If 401 unauthorized and shouldRedirect is true, redirect to login
      if (shouldRedirect && (error?.response?.status === 401 || error?.status === 401)) {
        redirect('/login');
      }
      throw error;
    }
  }

  async getFiles(): Promise<any> {
    const { token, clientInfo } = await this.getClientInfo();

    try {
      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.client_files.method,
        appmintEndpoints.client_files.path,
        token,
        null,
        clientInfo,
        false,
      );
      return response || [];
    } catch (error) {
      console.error('Error fetching files:', error);
      return [];
    }
  }

  /**
   * Upload a file
   * @param file - The file to upload
   * @param location - Optional folder location (e.g., "folder1/subfolder")
   */
  async uploadFile(file: File, location?: string): Promise<any> {
    const { token, clientInfo } = await this.getClientInfo();

    try {
      const formData = new FormData();
      formData.append('file', file);

      if (location) {
        formData.append('location', location);
      }

      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.client_file_upload.method,
        appmintEndpoints.client_file_upload.path,
        formData,
        token,
        null,
        clientInfo,
        true,
      );
      return response;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Delete a file by path
   * @param filePath - The path of the file to delete
   */
  async deleteFile(filePath: string): Promise<any> {
    const { token, clientInfo } = await this.getClientInfo();
    try {
      const response = await this.appEngineClient.processRequest(
        appmintEndpoints.client_file_delete.method,
        `${appmintEndpoints.client_file_delete.path}/${encodeURIComponent(filePath)}`,
        token,
        null,
        clientInfo,
        false,
      );
      return response;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (error?.response?.data?.message) {
      return new Error(error.response.data.message);
    }
    if (error?.message) {
      return new Error(error.message);
    }
    return new Error('An unexpected error occurred');
  }

  async getClientInfo() {
    const allHeaders = await headers();
    const allCookies = await cookies();

    // On server-side, activeSession won't have the token, so get from cookies directly
    let token = allCookies.get('token')?.value;

    // Add Bearer prefix if token exists and doesn't have it
    if (token && !token.startsWith('Bearer ')) {
      token = 'Bearer ' + token;
    }

    const clientInfo = await getRequestInfo(allHeaders);
    return { token, clientInfo };
  }
}

// Create a singleton instance
let appmintAuth: AppmintAuth;

/**
 * Get the AppmintAuth instance
 * @returns AppmintAuth instance
 */
export const getAppmintAuth = (): AppmintAuth => {
  if (!appmintAuth) {
    appmintAuth = new AppmintAuth();
  }
  return appmintAuth;
};
