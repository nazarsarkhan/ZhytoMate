# Civic glossary and query flow

The executable source of truth is [`ml-service/app/domain/civic_glossary.py`](../ml-service/app/domain/civic_glossary.py).
This document explains the vocabulary in human-readable form.

| Short form / alias | Meaning | Retrieval family |
| --- | --- | --- |
| ВПО, внутрішньо переміщені, переселенці | внутрішньо переміщена особа | Прозорий офіс, послуги ВПО |
| ЦНАП, прозорий офіс | центр надання адміністративних послуг | official CNAP wording |
| паспорт, ID-картка, закордонний паспорт | passport/document service | Прозорий офіс, отримати паспорт |
| ДМС | Державна міграційна служба | passport/document service |
| УСЗН, соцзахист, соцслужба, ПФУ | social and pension services | соціальні послуги |
| РНОКПП, ІПН, ІНН | taxpayer identification number | identification code |
| ЄДР, ЄДРПОУ | business/entity registry | entity registration |
| ЖКГ, комуналка, ОСББ | housing and communal services | житлово-комунальні питання |
| МВС, ГСЦ МВС | internal affairs/service centre | civic documents |
| ТЦК, військовий облік | military registration | military registration |
| КНП | communal non-commercial healthcare provider | healthcare |
| Дія | state digital services portal | digital services |

## Runtime flow

```text
user question
  -> OPSEC safety check
  -> glossary alias detection
  -> canonical retrieval anchor from official vocabulary
  -> civic intent/category (no category filter for mixed official services)
  -> dense + PostgreSQL lexical retrieval
  -> RRF fusion + lexical evidence gate
  -> answer only with trusted official sources
```

The glossary does not contain answers or addresses. It only prevents abbreviations and colloquial
forms from missing the relevant knowledge-base chunks. Grounding and trusted-source checks remain
mandatory.
