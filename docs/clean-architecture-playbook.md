# Clean Architecture Playbook for ZinoFlow

## 1) Design goals
Muc tieu bat buoc cua ung dung:
- De maintain khi mot minh van hanh dai han.
- De mo rong module moi ma khong sua nhieu code cu.
- De thay doi cong nghe (AI provider, storage, queue) voi anh huong toi thieu.
- De test logic nghiep vu khong phu thuoc UI hay framework.

## 2) Architecture style
Ap dung Modular Monolith + Clean Architecture.

- Modular Monolith de don gian van hanh local-first.
- Clean Architecture de tach business rule khoi framework.

## 3) Layer model
### Domain layer
- Chua entities, value objects, domain services, business rules.
- Khong phu thuoc database, HTTP, UI, queue, framework.

### Application layer
- Chua use cases (commands/queries), orchestration, validation nghiep vu.
- Dinh nghia interfaces cho external systems.
- Khong chua code SQL truc tiep, khong chua framework-specific code.

### Infrastructure layer
- Trien khai interfaces cua Application.
- Chua TypeORM/DB adapters, API clients, AI providers (Anthropic/OpenAI), pg-boss adapters, file storage.

### Presentation layer
- Web UI, REST controllers, request mapping.
- Khong chua business rules; chi mapping va dieu phoi use case.

## 4) Dependency rule (bat buoc)
Huong phu thuoc chi duoc di vao trong:
- Presentation -> Application -> Domain
- Infrastructure -> Application + Domain

Domain khong duoc tham chieu nguoc ra ben ngoai.
Application khong duoc phu thuoc truc tiep framework UI/DB.

## 5) Module boundaries cho MVP
### Module: AI Content
- Domain: article, draft, quality gates, review states.
- Application: generate outline/draft, approve, publish request.
- Infrastructure: AI provider adapters, prompt repository.

### Module: Image Tool
- Domain: image template, render job, output manifest.
- Application: create render job, validate payload, export outputs.
- Infrastructure: Remotion worker adapter, file storage adapter.

### Shared kernel (nho, on dinh)
- Shared IDs, result/error primitives, common enums co tinh on dinh cao.
- Khong dat business logic module vao shared kernel.

## 6) Contracts and versioning
- Moi giao tiep giua module va giua app voi CMS cu phai qua contract ro rang.
- Contract thay doi theo additive-first.
- Tranh rename/remove field trong cung major version.

## 7) Error handling strategy
- Standard error envelope:
  - errorCode
  - message
  - details[]
  - traceId
- Khong throw raw error sang client.
- Co map loi theo nhom: Validation, DomainRule, Upstream, Storage, Unknown.

## 8) Data and persistence strategy
- Domain model khong map 1:1 voi table mot cach may moc.
- Repository interface nam o Application.
- Repository implementation nam o Infrastructure.
- Migrations duoc version hoa va review nhu code.

## 9) Testing pyramid
### Unit tests (uu tien cao)
- Test business rules cua Domain va Application use cases.

### Integration tests
- Test adapters: DB, AI provider mock contract, CMS API client.

### E2E smoke tests
- Test cac flow chinh:
  - Tao draft content
  - Duyet draft
  - Tao render image

## 10) Coding conventions de maintain
- Mot file mot trach nhiem ro rang.
- Class nho, method ngan, ten theo business language.
- Khong su dung static helper la bai toan nghiep vu.
- Moi module co folder docs rieng va API examples.

## 11) Maintainability guardrails
- Rule 1: Khong dat business rule trong controller.
- Rule 2: Khong de UI state tro thanh source of truth nghiep vu.
- Rule 3: Khong de Infrastructure leaks vao Domain.
- Rule 4: Moi use case quan trong phai co test.
- Rule 5: Moi thay doi contract phai cap nhat docs + examples.

## 12) Extension strategy
Khi them module moi (vi du Analytics):
1. Dinh nghia domain language va entities truoc.
2. Them use cases vao Application.
3. Them adapters can thiet vao Infrastructure.
4. Them endpoints/UI o Presentation.
5. Them tests va docs contract.

## 13) PR checklist (bat buoc)
- Co vi pham dependency rule khong?
- Business rule co bi dat sai layer khong?
- Contract change co backward compatible khong?
- Co tests cho use case moi khong?
- Docs co duoc cap nhat khong?

## 14) Definition of architecture done
Kien truc dat yeu cau khi:
- Co the thay AI provider ma khong doi business rules.
- Co the thay storage local sang cloud ma khong doi use cases.
- Co the them template image moi ma khong chinh sua flow cu.
- Team co the doc module docs va code duoc trong 1-2 ngay onboard.
