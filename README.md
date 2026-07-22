<p align="center">
  <img src="assets/banner.png" alt="IntelliPlant Banner" width="100%">
</p>

<h1 align="center">IntelliPlant</h1>

<p align="center">
AI-Powered Industrial Safety Intelligence Platform for Zero-Harm Operations
</p>

<p align="center">
An Enterprise-Grade Industrial Intelligence Platform that unifies Machine Health, SCADA Analytics, Computer Vision, Operational Context and Regulatory Intelligence into a single predictive safety ecosystem.
</p>

<p align="center">

![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Latest-009688)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)
![Vite](https://img.shields.io/badge/Vite-Latest-646CFF)
![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-FF6F00)
![CatBoost](https://img.shields.io/badge/CatBoost-Fusion-yellow)
![License](https://img.shields.io/badge/License-MIT-green)

</p>

<p align="center">

<a href="https://github.com/vansh-tyagii/IntelliPlant">Repository</a> •
<a href="#overview">Overview</a> •
<a href="#features">Features</a> •
<a href="#architecture">Architecture</a> •
<a href="#installation">Installation</a>

</p>

---

# IntelliPlant

IntelliPlant is an AI-powered Industrial Safety Intelligence Platform designed to provide real-time predictive safety monitoring inside large industrial facilities.

Instead of analysing independent safety systems separately, IntelliPlant combines multiple AI engines into one unified decision-making pipeline capable of identifying compound industrial risks before they become critical.

The platform continuously integrates machine telemetry, industrial sensor analytics, PPE compliance, operational context and regulatory intelligence to provide safety officers with actionable recommendations, explainable AI predictions and live plant-wide situational awareness.

---

# Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Why IntelliPlant](#why-intelliplant)
- [Key Features](#features)
- [System Workflow](#system-workflow)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [Frontend Overview](#frontend-overview)
- [Backend Overview](#backend-overview)
- [Digital Twin](#digital-twin)
- [AI Modules](#ai-modules)
- [Fusion Engine](#fusion-engine)
- [API Documentation](#api-documentation)
- [Screenshots](#screenshots)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

# Overview

Modern industrial facilities generate enormous amounts of operational data through independent systems such as:

- Machine telemetry
- Industrial SCADA systems
- CCTV surveillance
- Worker safety monitoring
- Permit-to-work records
- Maintenance activities
- Shift operations
- Compliance documentation

Most organizations analyse these systems independently.

IntelliPlant introduces an enterprise intelligence layer capable of correlating all these independent signals into a unified plant-wide risk assessment.

Instead of reacting after an incident occurs, IntelliPlant focuses on predicting compound risks and providing preventive recommendations before safety incidents escalate.

---

# Problem Statement

Industrial environments rely on multiple isolated safety systems that rarely communicate with one another.

Critical safety events often emerge only when several independent conditions occur simultaneously.

Examples include:

- Equipment degradation during maintenance
- Worker PPE violations in hazardous areas
- Sensor anomalies during shift transitions
- Active permits overlapping dangerous operations

While each subsystem may appear normal individually, their combined operational context can indicate a significant safety threat.

IntelliPlant addresses this challenge by integrating multiple AI models into a unified intelligence platform capable of identifying complex safety scenarios through multi-source data fusion.

---

# Why IntelliPlant

Unlike traditional monitoring dashboards, IntelliPlant focuses on decision intelligence rather than isolated alerts.

It provides:

- Unified industrial intelligence
- Compound risk analysis
- Explainable AI predictions
- Live operational awareness
- Geospatial plant monitoring
- Regulatory guidance
- Incident intelligence
- Enterprise-ready architecture

---

# Features

## Industrial AI

- Predictive Machine Failure Analysis
- Industrial SCADA Anomaly Detection
- PPE Compliance Monitoring
- Compound Risk Fusion
- Explainable AI
- Live Risk Scoring

---

## Operational Intelligence

- Digital Twin
- Interactive Plant Heatmap
- Zone-based Monitoring
- Live Runtime State
- Timeline Events
- Incident Generation
- System Health Monitoring

---

## Enterprise Dashboard

- Executive Overview
- Plant Operations
- AI Insights
- Compliance Assistant
- Incident Center
- Timeline
- System Health
- Settings

---

## Multi-Agent Intelligence

The platform combines independent AI agents responsible for different industrial domains.

Each agent performs specialized reasoning while contributing to a shared operational safety context.

This modular architecture enables scalable industrial intelligence without tightly coupling individual AI models.

---

# System Workflow

```text
Industrial Data Sources

        │

        ▼

AI4I Machine Intelligence

        │

        ▼

SWAT Sensor Intelligence

        │

        ▼

PPE Vision Intelligence

        │

        ▼

Fusion Engine

        │

        ▼

Risk Classification

        │

        ▼

Digital Twin Update

        │

        ▼

Timeline

        │

        ▼

Incident Generation

        │

        ▼

Compliance Intelligence

        │

        ▼

Safety Recommendations
```

---

# Architecture

```
                    IntelliPlant

                 React Frontend

                        │

                 FastAPI Backend

                        │

     ┌────────────┬────────────┬────────────┐

     │            │            │            │

   AI4I         SWAT         PPE        Runtime

     │            │            │            │

     └────────────┴────────────┴────────────┘

                  Fusion Engine

                        │

                 Risk Intelligence

                        │

              Digital Twin & Heatmap

                        │

         Timeline • Incidents • RAG
```

---

# Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Ant Design
- React Query
- Zustand
- React Router
- Axios
- Framer Motion
- Apache ECharts
- Lucide Icons

---

## Backend

- FastAPI
- Python
- Pydantic
- Uvicorn

---

## Artificial Intelligence

- Random Forest
- LSTM Autoencoder
- CatBoost
- YOLO
- SHAP Explainability

---

## Data Processing

- NumPy
- Pandas
- Scikit-learn
- TensorFlow
- OpenCV

---

# Project Structure

```text
IntelliPlant/

├── frontend/
│
├── backend/
│
├── ai41/
│
├── swat/
│
├── PPE/
│
├── module45/
│
├── final_api/
│
├── plant_digital_twin/
│
├── runtime_uploads/
│
├── config.yaml
│
├── requirements.txt
│
└── README.md
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/vansh-tyagii/IntelliPlant.git

cd IntelliPlant
```

---

## Create Virtual Environment

```bash
python -m venv .venv
```

Windows

```bash
.venv\Scripts\activate
```

Linux / macOS

```bash
source .venv/bin/activate
```

---

## Install Backend Dependencies

```bash
pip install -r requirements.txt
```

---

## Install Frontend Dependencies

```bash
cd frontend

npm install
```

---

# Configuration

Create a `.env` file if required by your deployment.

Example:

```env
API_BASE_URL=http://localhost:8000
VITE_API_URL=http://localhost:8000
```

Adjust additional runtime paths according to your local environment if model artifacts or datasets are stored outside the repository.

---

# Running the Project

## Start Backend

```bash
uvicorn final_api.main:app --reload
```

Backend:

```
http://localhost:8000
```

Swagger:

```
http://localhost:8000/docs
```

---

## Start Frontend

```bash
cd frontend

npm run dev
```

Frontend:

```
http://localhost:5173
```

---

# Frontend Overview

The frontend is designed as an enterprise command center optimized for industrial operations.

Primary modules include:

- Executive Dashboard
- Plant Digital Twin
- Operations Control
- AI Insights
- Incident Center
- Compliance Assistant
- Timeline
- System Health
- Settings

The interface supports both Demo Mode and Live Mode while consuming backend APIs without implementing business logic inside the client.
