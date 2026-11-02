# SRD reference data

`srd-seed.json` contains only entries marked as part of the free System
Reference Documents by their source data:

- **SRD 5.1** (2014 rules) — `srd: true`
- **SRD 5.2** (2024 rules) — `srd52: true`

Both documents are licensed under the **Creative Commons Attribution 4.0
International License (CC-BY 4.0)**. No artwork or other illustrations are
included — only rules text and stat-block data.

## Required attribution

This work includes material taken from the System Reference Document 5.1
("SRD 5.1") by Wizards of the Coast LLC, available at
<https://dnd.wizards.com/resources/systems-reference-document>. The SRD 5.1 is
licensed under the Creative Commons Attribution 4.0 International License,
available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

This work includes material from the System Reference Document 5.2 ("SRD 5.2")
by Wizards of the Coast LLC, available at <https://www.dndbeyond.com/srd>. The
SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International
License, available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

## Regenerating

The seed is generated from a local 5eTools data checkout (5eTools itself is not
bundled or required at runtime):

```powershell
npm run srd:build -- "E:/path/to/5etools/data"
```
