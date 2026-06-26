import { describe, expect, it } from "vitest";
import {
  clientCaseMatchesBillingClient,
  groupItemsByClientCode,
  itemMatchesMatterCode,
  labelLeadingSegmentLooksLikeCaseTitle,
  officeItemsShareClientCaseLabel,
  matterClientContextFromDetail,
  type MatterClientContext
} from "@/lib/office-tasks/client-matter";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

const johnSmith: MatterClientContext = {
  code: "SMITH",
  name: "John Smith",
  caseTitle: "Collection"
};

function item(partial: Partial<OfficeItem> & Pick<OfficeItem, "clientCase">): OfficeItem {
  return {
    source: "Event",
    sheetName: "Events",
    rowNumber: 2,
    id: "PEO-EVT-0001",
    date: "2026-06-01",
    eventDate: "2026-06-01",
    filingDeadline: null,
    startTime: null,
    endTime: null,
    category: "Hearing",
    priority: "Normal",
    assignedTo: "Andrea",
    clientCase: partial.clientCase,
    venue: "RTC",
    details: "Hearing",
    previousAction: "",
    nextAction: "",
    status: "Open",
    done: false,
    completedDate: null,
    remarks: "",
    reminderDays: 0,
    calendarSync: false,
    calendarEventId: "",
    lastUpdated: null,
    platform: "",
    filingMode: "",
    pleadingType: "",
    pleadingCaseNature: "",
    receivedDate: null,
    periodToFileDays: 0,
    filingDate: null,
    ...partial
  };
}

const chickenTheft: MatterClientContext = {
  code: "CHICKEN",
  name: "Chicken",
  caseTitle: "Qualified Theft"
};

const janezzaSantos: MatterClientContext = {
  code: "PEO",
  name: "Janezza Santos",
  caseTitle: "People vs Santos"
};

describe("clientCaseMatchesBillingClient", () => {
  it("matches the canonical John Smith label", () => {
    expect(clientCaseMatchesBillingClient("John Smith — Collection", johnSmith)).toBe(true);
    expect(clientCaseMatchesBillingClient("SMITH — John Smith — Collection", johnSmith)).toBe(true);
  });

  it("rejects tasks when the billing case title differs from the tasks-sheet label", () => {
    expect(
      clientCaseMatchesBillingClient("John Smith — Collection", {
        code: "SMITH",
        name: "John Smith",
        caseTitle: "Labor case"
      })
    ).toBe(false);
  });

  it("rejects People criminal cases for John Smith", () => {
    expect(clientCaseMatchesBillingClient("PEO — People — Criminal", johnSmith)).toBe(false);
    expect(clientCaseMatchesBillingClient("People — People vs. Accused", johnSmith)).toBe(false);
  });

  it("rejects other Smith clients and Johnson false positives", () => {
    expect(clientCaseMatchesBillingClient("Jane Smith — Collection", johnSmith)).toBe(false);
    expect(clientCaseMatchesBillingClient("Bob Johnson — Collection", johnSmith)).toBe(false);
  });

  it("rejects labels with a different explicit client code", () => {
    expect(clientCaseMatchesBillingClient("BAC — Bacus — Civil case", johnSmith)).toBe(false);
  });

  it("rejects case-title-only labels without client name and case title together", () => {
    expect(
      clientCaseMatchesBillingClient("Qualified Theft — Hearing Monday", chickenTheft, "QUA-EVT-0042")
    ).toBe(false);
    expect(
      clientCaseMatchesBillingClient("Qualified Theft — Hearing Monday", chickenTheft, "CHI-EVT-0042")
    ).toBe(false);
    expect(
      clientCaseMatchesBillingClient("CHICKEN — Chicken — Qualified Theft", chickenTheft, "QUA-EVT-0042")
    ).toBe(true);
  });

  it("rejects labels that omit the billing case title", () => {
    expect(clientCaseMatchesBillingClient("Chicken — Hearing Monday", chickenTheft, "CHI-EVT-0042")).toBe(false);
  });

  it("still rejects unrelated matters that share a generic word", () => {
    expect(clientCaseMatchesBillingClient("PEO — People — Criminal", chickenTheft, "PEO-EVT-0001")).toBe(false);
  });

  it("does not mix qualified theft with people vs santos or match unrelated crime labels", () => {
    expect(
      clientCaseMatchesBillingClient("Qualified Parricide — filing Monday", chickenTheft, "QUA-EVT-0001")
    ).toBe(false);
    expect(
      clientCaseMatchesBillingClient("Qualified Theft — filing Monday", janezzaSantos, "QUA-EVT-0002")
    ).toBe(false);
    expect(
      clientCaseMatchesBillingClient("Qualified Parricide — filing Monday", janezzaSantos, "QUA-EVT-0003")
    ).toBe(false);
    expect(
      clientCaseMatchesBillingClient("People vs Santos — Qualified Parricide", janezzaSantos, "PEO-EVT-0003")
    ).toBe(true);
    expect(
      clientCaseMatchesBillingClient("Janezza Santos — People vs Santos", janezzaSantos, "PEO-EVT-0004")
    ).toBe(true);
  });

  it("does not merge Heirs of Tionko matters that only share the client name", () => {
    const heirsNha: MatterClientContext = {
      code: "HEI-NHA",
      name: "Heirs of Tionko",
      caseTitle: "Heirs of Tionko vs. NHA et al."
    };
    const heirsHlurb: MatterClientContext = {
      code: "HEI-HLURB",
      name: "Heirs of Tionko",
      caseTitle: "Heirs of Tionko vs. HLURB"
    };

    expect(
      clientCaseMatchesBillingClient("Heirs of Tionko — NHA et al.", heirsNha, "HEI-EVT-0001")
    ).toBe(true);
    expect(
      clientCaseMatchesBillingClient("Heirs of Tionko — HLURB", heirsHlurb, "HEI-EVT-0002")
    ).toBe(true);
    expect(
      clientCaseMatchesBillingClient("Heirs of Tionko — HLURB", heirsNha, "HEI-EVT-0002")
    ).toBe(false);
    expect(
      clientCaseMatchesBillingClient("Heirs of Tionko — NHA et al.", heirsHlurb, "HEI-EVT-0001")
    ).toBe(false);
  });

  it("respects case number when both billing and label include it", () => {
    const heirsNha: MatterClientContext = {
      code: "HEI-NHA",
      name: "Heirs of Tionko",
      caseTitle: "Heirs of Tionko vs. NHA et al.",
      caseNumber: "CA-12345"
    };

    expect(
      clientCaseMatchesBillingClient("Heirs of Tionko — NHA et al. — Case No. CA-12345", heirsNha, "HEI-EVT-0003")
    ).toBe(true);
    expect(
      clientCaseMatchesBillingClient("Heirs of Tionko — NHA et al. — Case No. CA-99999", heirsNha, "HEI-EVT-0004")
    ).toBe(false);
  });

  it("does not match sibling captions that share the HEI task prefix", () => {
    const heirsNha: MatterClientContext = {
      code: "HEI-NHA",
      name: "Heirs of Tionko",
      caseTitle: "Heirs of Tionko vs. NHA et al."
    };
    const heirsHlurb: MatterClientContext = {
      code: "HEI-HLURB",
      name: "Heirs of Tionko",
      caseTitle: "Heirs of Tionko vs. HLURB"
    };

    expect(
      clientCaseMatchesBillingClient("Heirs of Tionko vs. HLURB", heirsNha, "HEI-EVT-0010")
    ).toBe(false);
    expect(
      clientCaseMatchesBillingClient("Heirs of Tionko", heirsNha, "HEI-EVT-0011")
    ).toBe(false);
    expect(
      clientCaseMatchesBillingClient("HEI — Heirs of Tionko — HLURB", heirsNha, "HEI-EVT-0012")
    ).toBe(false);
    expect(
      clientCaseMatchesBillingClient("Heirs of Tionko vs. HLURB", heirsHlurb, "HEI-EVT-0010")
    ).toBe(true);
  });

  it("does not pull every Heirs of Tionko task onto Martin Tionko billing just because the code contains tionko", () => {
    const martinSuravilla: MatterClientContext = {
      code: "TIONKO",
      name: "Martin Tionko",
      caseTitle: "Heirs of Tionko vs. Suravilla & HLURB"
    };

    expect(
      clientCaseMatchesBillingClient(
        "Martin Tionko — Heirs of Tionko vs. Suravilla & HLURB",
        martinSuravilla,
        "MAR-EVT-0001"
      )
    ).toBe(true);
    expect(
      clientCaseMatchesBillingClient(
        "Heirs of Tionko c/o Rafael Angelo T. Reyes — Heirs of Tionko vs. NHA, et. al",
        martinSuravilla,
        "HEI-EVT-0002"
      )
    ).toBe(false);
    expect(
      clientCaseMatchesBillingClient("TIONKO — Email Quieting of Title to Tionko and Gahol", martinSuravilla, "TIO-TASK-0003")
    ).toBe(false);
  });

  it("does not merge two clients that share the same case title", () => {
    const otherTheft: MatterClientContext = {
      code: "BACO",
      name: "Baco",
      caseTitle: "Qualified Theft"
    };
    expect(
      clientCaseMatchesBillingClient("Qualified Theft — hearing", otherTheft, "QUA-EVT-0010")
    ).toBe(false);
    expect(
      clientCaseMatchesBillingClient("Baco — Qualified Theft", otherTheft, "BAC-EVT-0010")
    ).toBe(true);
    expect(
      clientCaseMatchesBillingClient("Chicken — Qualified Theft", chickenTheft, "CHI-EVT-0010")
    ).toBe(true);
    expect(clientCaseMatchesBillingClient("Qualified Theft — hearing", chickenTheft, "CHI-EVT-0010")).toBe(
      false
    );
    expect(clientCaseMatchesBillingClient("Qualified Theft — hearing", chickenTheft, "QUA-EVT-0010")).toBe(
      false
    );
  });
});

describe("officeItemsShareClientCaseLabel", () => {
  it("does not link rows that only share a crime name", () => {
    const chickenEvent = item({ clientCase: "Qualified Theft — Monday filing", id: "QUA-EVT-0001" });
    const bacoEvent = item({
      clientCase: "Qualified Theft — Tuesday filing",
      id: "QUA-EVT-0002",
      rowNumber: 3
    });
    expect(labelLeadingSegmentLooksLikeCaseTitle(chickenEvent.clientCase)).toBe(true);
    expect(officeItemsShareClientCaseLabel(chickenEvent, bacoEvent)).toBe(false);
    expect(labelLeadingSegmentLooksLikeCaseTitle("People vs Santos — Qualified Parricide")).toBe(false);
  });

  it("links rows with the same client name segment and matching id prefix", () => {
    const a = item({ clientCase: "Chicken — Qualified Theft", id: "CHI-EVT-0001" });
    const b = item({
      source: "Task",
      clientCase: "Chicken — filing prep",
      id: "CHI-TASK-0002",
      rowNumber: 3
    });
    expect(officeItemsShareClientCaseLabel(a, b)).toBe(true);
  });
});

describe("matterClientContextFromDetail", () => {
  it("infers a case caption suffix from the billing code when case title is blank", () => {
    expect(
      matterClientContextFromDetail({
        code: "HEI-NHA",
        name: "Heirs of Tionko",
        caseTitle: ""
      })
    ).toEqual({
      code: "HEI-NHA",
      name: "Heirs of Tionko",
      caseTitle: "NHA",
      caseNumber: undefined
    });
  });
});

describe("groupItemsByClientCode", () => {
  it("returns nothing for a billing matter code until client identity is known", () => {
    const grouped = groupItemsByClientCode(
      [
        item({
          clientCase: "Heirs of Tionko — NHA et al.",
          id: "HEI-EVT-0001"
        }),
        item({
          clientCase: "Heirs of Tionko — HLURB",
          id: "HEI-EVT-0002",
          rowNumber: 3
        })
      ],
      "HEI-NHA",
      "HEI",
      null
    );
    expect(grouped.events).toHaveLength(0);
  });

  it("includes filing prep tasks linked to matched events", () => {
    const items = [
      item({
        clientCase: "John Smith — Collection",
        id: "JOH-EVT-0001",
        category: "Court Filing",
        filingDeadline: "2026-06-15"
      }),
      item({
        source: "Task",
        clientCase: "Legacy prep label",
        id: "JOH-TASK-0002",
        rowNumber: 3,
        category: "Filing prep",
        details: "Filing prep for initiatory pleading",
        remarks: "EVENT_REMINDER:JOH-EVT-0001\nLINKED_REMINDER_TASK:JOH-TASK-0002"
      })
    ];

    const grouped = groupItemsByClientCode(items, "SMITH", "JOH", johnSmith);
    expect(grouped.events).toHaveLength(1);
    expect(grouped.tasks).toHaveLength(1);
    expect(grouped.tasks[0].id).toBe("JOH-TASK-0002");
  });

  it("includes prep tasks resolved via filing event match", () => {
    const items = [
      item({
        clientCase: "John Smith — Collection",
        id: "JOH-EVT-0001",
        category: "Court Filing",
        filingDeadline: "2026-06-15"
      }),
      item({
        source: "Task",
        clientCase: "John Smith — filing prep",
        id: "JOH-TASK-0009",
        rowNumber: 4,
        category: "Filing prep",
        details: "Filing prep for initiatory pleading due 2026-06-15 (this task is due 3 days before).",
        remarks: ""
      })
    ];

    const grouped = groupItemsByClientCode(items, "SMITH", "JOH", johnSmith);
    expect(grouped.tasks.map((task) => task.id)).toContain("JOH-TASK-0009");
  });

  it("includes separate prep tasks for separate filing events on the same matter", () => {
    const clientCase = "John Smith — Collection";
    const items = [
      item({
        clientCase,
        id: "JOH-EVT-0001",
        category: "Court Filing",
        filingDeadline: "2026-06-15"
      }),
      item({
        clientCase,
        id: "JOH-EVT-0002",
        rowNumber: 3,
        category: "Court Filing",
        filingDeadline: "2026-07-20"
      }),
      item({
        source: "Task",
        clientCase,
        id: "JOH-TASK-0001",
        rowNumber: 4,
        category: "Filing prep",
        remarks: "EVENT_REMINDER:JOH-EVT-0001",
        details:
          "Filing prep for initiatory pleading due 2026-06-15 (this task is due 3 days before)."
      }),
      item({
        source: "Task",
        clientCase,
        id: "JOH-TASK-0002",
        rowNumber: 5,
        category: "Filing prep",
        remarks: "EVENT_REMINDER:JOH-EVT-0002",
        details:
          "Filing prep for responsive pleading due 2026-07-20 (this task is due 3 days before)."
      })
    ];

    const grouped = groupItemsByClientCode(items, "SMITH", "JOH", johnSmith);
    expect(grouped.events).toHaveLength(2);
    expect(grouped.tasks.map((task) => task.id).sort()).toEqual(["JOH-TASK-0001", "JOH-TASK-0002"]);
  });

  it("lists orphan prep on the matter but does not link it to a filing event", () => {
    const items = [
      item({
        clientCase: "John Smith — Collection",
        id: "JOH-EVT-0001",
        category: "Court Filing",
        filingDeadline: "2026-06-15"
      }),
      item({
        source: "Task",
        clientCase: "John Smith — Collection",
        id: "JOH-TASK-0099",
        rowNumber: 3,
        category: "Filing prep",
        details: "Filing prep for initiatory pleading (this task is due 3 days before)."
      })
    ];

    const grouped = groupItemsByClientCode(items, "SMITH", "JOH", johnSmith);
    expect(grouped.tasks.map((task) => task.id)).toEqual(["JOH-TASK-0099"]);
    expect(grouped.events).toHaveLength(1);
  });

  it("only groups rows that belong to the billing client", () => {
    const items = [
      item({ clientCase: "John Smith — Collection", id: "JOH-EVT-0001" }),
      item({ clientCase: "PEO — People — Criminal", id: "PEO-EVT-0002", rowNumber: 3 }),
      item({ clientCase: "Jane Smith — Collection", id: "JAN-EVT-0003", rowNumber: 4 })
    ];

    const grouped = groupItemsByClientCode(items, "SMITH", "JOH", johnSmith);
    expect(grouped.events).toHaveLength(1);
    expect(grouped.events[0].clientCase).toBe("John Smith — Collection");
  });

  it("only groups rows that pass the threefold identity check", () => {
    const items = [
      item({
        clientCase: "Qualified Theft — Hearing Monday",
        id: "CHI-EVT-0006",
        date: "2026-06-08",
        eventDate: "2026-06-08"
      }),
      item({
        clientCase: "Qualified Theft — Hearing Monday",
        id: "QUA-EVT-0007",
        date: "2026-06-09",
        eventDate: "2026-06-09"
      }),
      item({
        clientCase: "Chicken — Qualified Theft — Hearing Monday",
        id: "CHI-EVT-0007",
        rowNumber: 3,
        date: "2026-06-09",
        eventDate: "2026-06-09"
      }),
      item({
        clientCase: "People vs Santos — Qualified Parricide",
        id: "PEO-EVT-0008",
        rowNumber: 4,
        date: "2026-06-10",
        eventDate: "2026-06-10"
      })
    ];

    const chickenGrouped = groupItemsByClientCode(items, "CHICKEN", "CHI", chickenTheft);
    expect(chickenGrouped.events.map((event) => event.id).sort()).toEqual(["CHI-EVT-0007"]);

    const santosGrouped = groupItemsByClientCode(items, "PEO", "PEO", janezzaSantos);
    expect(santosGrouped.events.map((event) => event.id)).toEqual(["PEO-EVT-0008"]);
  });

  it("keeps sibling Heirs of Tionko matters separate on the matter page", () => {
    const heirsNha: MatterClientContext = {
      code: "HEI-NHA",
      name: "Heirs of Tionko",
      caseTitle: "Heirs of Tionko vs. NHA et al."
    };
    const heirsHlurb: MatterClientContext = {
      code: "HEI-HLURB",
      name: "Heirs of Tionko",
      caseTitle: "Heirs of Tionko vs. HLURB"
    };
    const items = [
      item({
        clientCase: "Heirs of Tionko — NHA et al.",
        id: "HEI-EVT-0001",
        category: "Court Filing",
        filingDeadline: "2026-06-09"
      }),
      item({
        clientCase: "Heirs of Tionko — HLURB",
        id: "HEI-EVT-0002",
        rowNumber: 3,
        category: "Court Filing",
        filingDeadline: "2026-06-12"
      }),
      item({
        clientCase: "Heirs of Tionko vs. HLURB",
        id: "HEI-EVT-0003",
        rowNumber: 4,
        category: "Hearing",
        date: "2026-06-15",
        eventDate: "2026-06-15"
      })
    ];

    const nhaGrouped = groupItemsByClientCode(items, "HEI-NHA", "HEI", heirsNha);
    expect(nhaGrouped.events.map((event) => event.clientCase)).toEqual(["Heirs of Tionko — NHA et al."]);

    const hlurbGrouped = groupItemsByClientCode(items, "HEI-HLURB", "HEI", heirsHlurb);
    expect(hlurbGrouped.events.map((event) => event.clientCase).sort()).toEqual(
      ["Heirs of Tionko — HLURB", "Heirs of Tionko vs. HLURB"].sort()
    );
  });

  it("does not mix NHA heirs work into Martin Tionko billing profile", () => {
    const martinSuravilla: MatterClientContext = {
      code: "TIONKO",
      name: "Martin Tionko",
      caseTitle: "Heirs of Tionko vs. Suravilla & HLURB"
    };
    const items = [
      item({
        clientCase: "Martin Tionko — Heirs of Tionko vs. Suravilla & HLURB",
        id: "MAR-EVT-0001",
        category: "Court Follow-up",
        date: "2026-06-12",
        eventDate: "2026-06-12"
      }),
      item({
        source: "Task",
        clientCase:
          "Heirs of Tionko c/o Rafael Angelo T. Reyes — Heirs of Tionko vs. NHA, et. al",
        id: "HEI-TASK-0002",
        rowNumber: 3,
        category: "Filing prep",
        date: "2026-06-16"
      }),
      item({
        source: "Task",
        clientCase: "TIONKO — Email Quieting of Title to Tionko and Gahol",
        id: "TIO-TASK-0003",
        rowNumber: 4,
        date: "2026-06-17"
      })
    ];

    const grouped = groupItemsByClientCode(items, "TIONKO", "MAR", martinSuravilla);
    expect(grouped.events.map((event) => event.clientCase)).toEqual([
      "Martin Tionko — Heirs of Tionko vs. Suravilla & HLURB"
    ]);
    expect(grouped.tasks).toHaveLength(0);
  });

  it("keeps People vs Santos off the Chicken matter even with a mismatched task id prefix", () => {
    const items = [
      item({
        clientCase: "Chicken — Qualified Theft",
        id: "CHI-EVT-0001",
        category: "Court Filing",
        filingDeadline: "2026-06-09"
      }),
      item({
        clientCase: "People vs Santos — Qualified Parricide",
        id: "CHI-EVT-0002",
        rowNumber: 3,
        category: "Court Filing",
        filingDeadline: "2026-06-12"
      })
    ];

    const grouped = groupItemsByClientCode(items, "CHICKEN", "CHI", chickenTheft);
    expect(grouped.events.map((event) => event.clientCase)).toEqual(["Chicken — Qualified Theft"]);
  });
});

describe("itemMatchesMatterCode", () => {
  it("does not match blank clientCase rows by billing code prefix alone", () => {
    const orphan = item({ clientCase: "", id: "SMI-EVT-0099" });
    expect(itemMatchesMatterCode(orphan, "SMITH", "JOH", johnSmith)).toBe(false);
  });

  it("does not match blank clientCase rows by task id prefix alone", () => {
    const orphan = item({ clientCase: "", id: "JOH-EVT-0099" });
    expect(itemMatchesMatterCode(orphan, "SMITH", "JOH", johnSmith)).toBe(false);
  });

  it("rejects crime-first hearing rows without client name and case title on the label", () => {
    const hearing = item({
      clientCase: "Qualified Theft — Hearing Monday",
      id: "CHI-EVT-0011",
      category: "Hearing",
      date: "2026-06-09",
      eventDate: "2026-06-09"
    });
    expect(itemMatchesMatterCode(hearing, "CHICKEN", "CHI", chickenTheft)).toBe(false);
  });

  it("does not match stale labels without the client name or case title", () => {
    const filing = item({
      clientCase: "Old intake label — court follow-up",
      id: "CHI-EVT-0010",
      category: "Court Filing",
      filingDeadline: "2026-06-09",
      date: "2026-06-09",
      eventDate: "2026-06-09"
    });
    expect(itemMatchesMatterCode(filing, "CHICKEN", "CHI", chickenTheft)).toBe(false);
  });

  it("matches rows when the label includes the client name and case title", () => {
    const filing = item({
      clientCase: "Chicken — Qualified Theft — court follow-up",
      id: "CHI-EVT-0010",
      category: "Court Filing",
      filingDeadline: "2026-06-09",
      date: "2026-06-09",
      eventDate: "2026-06-09"
    });
    expect(itemMatchesMatterCode(filing, "CHICKEN", "CHI", chickenTheft)).toBe(true);
  });
});
