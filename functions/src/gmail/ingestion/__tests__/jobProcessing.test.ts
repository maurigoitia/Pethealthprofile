// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildRecoveredRawDocumentFromIngestionDocument } from "../jobProcessing";

describe("jobProcessing raw context recovery", () => {
  it("reconstruye contexto mínimo desde gmail_ingestion_documents para mails attachment-first", () => {
    const recovered = buildRecoveredRawDocumentFromIngestionDocument({
      ingestionDocument: {
        thread_id: "thread-1",
        email_date: "2025-08-22T00:13:39.000Z",
        from_email: "laura diaz <lvdiazz@yahoo.com.ar>",
        subject: "ECO THOR",
        hash_signature_raw: "raw-hash-1",
        attachment_metadata: [
          {
            filename: "GOITA THOR.pdf",
            mimetype: "application/pdf",
            size_bytes: 321937,
            ocr_success: false,
          },
        ],
      },
      sessionId: "session-1",
      uid: "user-1",
      messageId: "msg-1",
    });

    expect(recovered).toMatchObject({
      sessionId: "session-1",
      uid: "user-1",
      messageId: "msg-1",
      threadId: "thread-1",
      emailDate: "2025-08-22T00:13:39.000Z",
      sourceSender: "laura diaz <lvdiazz@yahoo.com.ar>",
      sourceSubject: "ECO THOR",
      bodyText: "",
      hashSignatureRaw: "raw-hash-1",
    });
    expect(recovered?.attachmentMeta).toHaveLength(1);
    expect(recovered?.attachmentMeta[0]?.filename).toBe("GOITA THOR.pdf");
  });

  it("usa sender y subject del payload cuando el documento persistido es parcial", () => {
    const recovered = buildRecoveredRawDocumentFromIngestionDocument({
      ingestionDocument: {
        attachment_metadata: [
          {
            filename: "thor-eco.pdf",
            mimetype: "application/pdf",
            size_bytes: 2048,
            ocr_success: false,
          },
        ],
      },
      sessionId: "session-2",
      uid: "user-2",
      messageId: "msg-2",
      sourceSender: "estudios@vetclinic.com",
      sourceSubject: "Ecografia Thor",
    });

    expect(recovered?.sourceSender).toBe("estudios@vetclinic.com");
    expect(recovered?.sourceSubject).toBe("Ecografia Thor");
    expect(recovered?.hashSignatureRaw).toBeTruthy();
  });
});
