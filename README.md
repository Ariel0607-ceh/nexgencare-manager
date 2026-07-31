# NexGenCare Manager 🏥

> **A comprehensive, AI-assisted care management platform designed to streamline operations, enhance client communication and secure administrative workflows.**

## 🌐 Live Prototype
Experience the live application here: **[nexgencare-manager.vercel.app](https://nexgencare-manager.vercel.app/)**

---

## 📊 Business Overview
*Note: This project was developed as part of a business assessment project.*

NexGenCare Manager addresses the growing need for efficient, secure and user-friendly administrative tools in the healthcare and caregiving sector. Our platform provides a centralized hub for managing client data, staff assignments and day-to-day operations, bridging the gap between care providers and care receivers.

**Key Value Propositions:**
* **Operational Efficiency:** Reduces manual paperwork and administrative overhead through a centralized digital management system.
* **Data Security & Privacy:** Strict role-based access control (RBAC) ensures sensitive health and client data is only accessible to authorized personnel.
* **Modern User Experience:** An intuitive, responsive interface that reduces the learning curve for staff and clients alike.

---

## ✨ Core Features

### 🔐 Security & Authentication
* **Role-Based Access Control (RBAC):** Secure routing that strictly separates administrative privileges from client-facing views.
* **Encrypted Sessions:** Utilizes JSON Web Tokens (JWT) for secure session management and `bcryptjs` for robust password hashing.
* **Protected Administrative Routes:** Unauthorized users are automatically redirected away from sensitive management pages.

### 👨‍💼 Administrator Portal
* **Command Dashboard (`/admin/dashboard`):** A high-level overview of facility operations, active clients and system status.
* **Client Management (`/admin/clients`):** A comprehensive directory to view, add and manage client profiles and care requirements.
* **Seamless Navigation:** Built with an intuitive sidebar/navbar layout for quick access to various management tools.

### 👤 Client Portal
* **Dedicated Client Interface:** A default, welcoming portal for clients to log in and view their specific care plans and updates.
* **Mobile-Responsive Design:** Fully accessible on smartphones, tablets and desktops so clients can check in from anywhere.

### 🎨 UI/UX Design
* **Modern Interface:** Built utilizing Shadcn UI (New York style) and Lucide Icons for a clean, professional aesthetic.
* **Theme Support:** Configured with advanced CSS variables to support dynamic Light and Dark modes.

---

## 🛠️ Technology Stack

**Frontend (Client & UI)**
* React.js (Component-based UI)
* React Router (Client-side routing)
* Tailwind CSS (Utility-first styling)
* Shadcn UI (Accessible component library)
* Vercel (Cloud hosting and deployment)

**Backend (API & Database)**
* Node.js & Express.js (Server framework)
* PostgreSQL (Relational database)
* Prisma ORM (Database schema management and querying)

---
