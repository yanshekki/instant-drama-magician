# Legal documents (in-app)

> **Language:** [English](./legal.md) · [中文](./legal-ZH.md)

In-app **Disclaimer** and **Acceptable Use Policy** live under `legal.*` in locale JSON and are versioned in `src/domain/legal.ts`.

| Constant | Current |
|----------|---------|
| `LEGAL_VERSION` | **1.0.0** |
| `LEGAL_EFFECTIVE_DATE` | 2026-07-19 |

## Structure (expanded protection body)

> **Product acceptance version** is `LEGAL_VERSION` **1.0.0** (table above).  
> “12 sections” describes the **document outline**, not a separate 2.0.0 product version.

Each document has **12 sections** (`s1`–`s12`).

### Disclaimer

1. Parties, product and scope  
2. No warranties; as-is / as-available  
3. AI-generated and automated content risks  
4. Third-party services, API keys, accounts  
5. Your content, local data, backups, self-hosting  
6. IP of the software vs your outputs  
7. Open-source components and system tools  
8. Security; no guarantee of invulnerability  
9. Limitation of liability (aggregate cap)  
10. Indemnity  
11. Beta / experimental / changing features  
12. Governing law (HK SAR), consumers, severability, entire agreement  

### Acceptable Use

1. Eligibility and acceptance  
2. Lawful use only  
3. Strictly prohibited content and conduct  
4. Rights, likeness, music, third-party IP  
5. Third-party AI and platform policies  
6. Security, credentials, web server mode  
7. Privacy and personal data you process  
8. Commercial use of outputs; no sponsorship  
9. Fair use of the software and updates  
10. Enforcement and suspension of support  
11. Export, sanctions, regional restrictions  
12. Changes, versioning, survival  

## Drafting languages

- **Primary:** `zh-HK`, `en`  
- **zh-CN:** OpenCC from zh-HK  
- **Other UI locales:** English legal package until professionally translated  

## Product behaviour

- Users must accept the current `LEGAL_VERSION` before using the app.  
- Bumping `LEGAL_VERSION` forces re-acceptance.  
- Settings and Help menu can re-open documents.  

This is product UX / terms-of-use copy, not a substitute for counsel. For commercial distribution, have a lawyer review, then bump the version after edits.

Contact: [email@ysk.hk](mailto:email@ysk.hk)
