import express from "express";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (err) {
  console.error("Error reading firebase-applet-config.json:", err);
}

// Initialize Firebase Admin using default credentials (which work out-of-the-box in Cloud Run)
if (getApps().length === 0 && firebaseConfig.projectId) {
  try {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log("Firebase Admin successfully initialized!");
  } catch (err) {
    console.error("Error initializing Firebase Admin:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Inspect user status
  app.get("/api/auth/inspect/:email", async (req, res) => {
    const { email } = req.params;
    try {
      const dbInstance = getFirestore(undefined, firebaseConfig.firestoreDatabaseId);
      const authInstance = getAuth();
      
      let firestoreUser: any = null;
      const usersRef = dbInstance.collection("users");
      const querySnapshot = await usersRef.where("email", "==", email).get();
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        firestoreUser = { id: doc.id, ...doc.data() };
      }

      let authUser: any = null;
      try {
        const userRec = await authInstance.getUserByEmail(email);
        authUser = {
          uid: userRec.uid,
          email: userRec.email,
          disabled: userRec.disabled,
          passwordHash: userRec.passwordHash ? "[HAS_HASH]" : "[NO_HASH]",
          emailVerified: userRec.emailVerified
        };
      } catch (authError: any) {
        authUser = { error: authError.message, code: authError.code };
      }

      res.json({
        email,
        firestoreUser,
        authUser
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update password API
  app.post("/api/auth/update-password", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required." });
      return;
    }

    try {
      const dbInstance = getFirestore(undefined, firebaseConfig.firestoreDatabaseId);
      const authInstance = getAuth();
      
      // Step 1: Look up the user in Firestore to find their document/UID
      const usersRef = dbInstance.collection("users");
      const querySnapshot = await usersRef.where("email", "==", email).limit(1).get();
      
      let uid: string;
      if (querySnapshot.empty) {
        // If they don't exist in Firestore, generate a new custom UID
        uid = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      } else {
        uid = querySnapshot.docs[0].id;
      }

      // Step 2: Update or create in Firebase Authentication
      try {
        await authInstance.getUser(uid);
        // User exists in Auth, update password
        await authInstance.updateUser(uid, { password });
      } catch (authError: any) {
        if (authError.code === "auth/user-not-found") {
          // Check if email already exists in Auth under a different UID
          try {
            const existingByEmail = await authInstance.getUserByEmail(email);
            // Email exists under a different UID, update password on that UID
            uid = existingByEmail.uid;
            await authInstance.updateUser(uid, { password });
          } catch (emailError: any) {
            if (emailError.code === "auth/user-not-found") {
              // Email doesn't exist in Auth at all, create new Auth user
              await authInstance.createUser({
                uid,
                email,
                password,
              });
            } else {
              throw emailError;
            }
          }
        } else {
          throw authError;
        }
      }

      // Step 3: Update Firestore document
      const userDocRef = usersRef.doc(uid);
      const docSnapshot = await userDocRef.get();
      
      if (docSnapshot.exists) {
        await userDocRef.update({ password });
      } else {
        // If not exists, write initial profile
        await userDocRef.set({
          uid,
          email,
          password,
          name: email.split("@")[0],
          role: "student", // default role
          xp: 0,
          level: 1,
          badges: [],
          mode: "online",
          lastLogin: new Date().toISOString()
        }, { merge: true });
      }

      res.json({
        success: true,
        uid,
        message: `Successfully set password for ${email} in Firebase Authentication and Firestore database.`
      });
    } catch (err: any) {
      console.error("Failed to set password via admin backend:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoint to test SMTP configuration
  app.get("/api/auth/test-smtp", async (req, res) => {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      res.json({
        success: false,
        configured: false,
        error: "SMTP environment variables are incomplete. Please provide SMTP_HOST, SMTP_USER, and SMTP_PASS."
      });
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort) || 587,
        secure: Number(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.verify();
      res.json({
        success: true,
        configured: true,
        message: "SMTP connection established successfully! Credentials and server settings are valid."
      });
    } catch (err: any) {
      console.error("SMTP verification failed:", err);
      res.json({
        success: false,
        configured: true,
        error: err.message || "Unknown error occurred while verifying SMTP connection."
      });
    }
  });

  // Password reset request API for registered accounts
  app.post("/api/auth/request-reset", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: "Email is required." });
      return;
    }

    try {
      const dbInstance = getFirestore(undefined, firebaseConfig.firestoreDatabaseId);
      
      // Save the request to Firestore passwordResetRequests
      const resetRef = dbInstance.collection("passwordResetRequests");
      const docRef = await resetRef.add({
        email: email.trim().toLowerCase(),
        status: "pending",
        requestedAt: new Date().toISOString(),
      });

      // Check if SMTP is configured to send the email automatically
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || "no-reply@funscholar.com";

      let emailSent = false;
      let emailError = "";

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: Number(smtpPort) || 587,
            secure: Number(smtpPort) === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });

          await transporter.sendMail({
            from: smtpFrom,
            to: "risheb@funscholar.com",
            subject: `[FunScholar] Password Reset Request for Account: ${email}`,
            text: `Hello Admin,\n\nA user with the registered account/email "${email}" has requested a password reset.\n\nPlease log in to the FunScholar Admin Panel to reset their password using the Users/Teachers management console.\n\nBest regards,\nFunScholar LMS Automation`,
            html: `<p>Hello Admin,</p>
                   <p>A user with the registered account/email <strong>${email}</strong> has requested a password reset.</p>
                   <p>Please log in to the FunScholar Admin Panel to reset their password using the Users/Teachers management console.</p>
                   <p>Best regards,<br/>FunScholar LMS Automation</p>`
          });
          emailSent = true;
        } catch (err: any) {
          console.error("Nodemailer failed to send email:", err);
          emailError = err.message;
        }
      } else {
        console.log("SMTP not fully configured. Email sending skipped. Saved to Firestore instead.");
        emailError = "SMTP credentials not configured. Please use SMTP_HOST, SMTP_USER, SMTP_PASS in your environment to enable background emails.";
      }

      res.json({
        success: true,
        requestId: docRef.id,
        emailSent,
        emailError: emailError || undefined,
        message: "Password reset request recorded successfully."
      });

    } catch (err: any) {
      console.error("Error creating reset request:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
