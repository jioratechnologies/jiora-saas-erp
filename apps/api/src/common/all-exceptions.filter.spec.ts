import { ArgumentsHost, BadRequestException, ForbiddenException, HttpException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] as { statusCode: number; message: unknown } };
}

const prismaErr = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on the fields: (\`name\`) ${code}`, {
    code,
    clientVersion: "5.0.0",
  });

describe("AllExceptionsFilter", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });
  afterEach(() => jest.restoreAllMocks());

  it("P2002 -> 409", () => {
    const { status, body } = run(prismaErr("P2002"));
    expect(status).toBe(409);
    expect(body.message).toBe("A record with this name already exists. Please choose a different one.");
  });

  it("P2025 -> 404", () => {
    const { status, body } = run(prismaErr("P2025"));
    expect(status).toBe(404);
    expect(body.message).toBe("The requested item could not be found.");
  });

  it("P2003 -> 400", () => {
    expect(run(prismaErr("P2003")).status).toBe(400);
  });

  it("unknown Prisma code -> 500 generic, no leak", () => {
    const { status, body } = run(prismaErr("P2999"));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toMatch(/P2\d{3}|Unique constraint/);
  });

  it("unknown error -> 500 generic, no stack leak", () => {
    const err = new Error("secret db password leaked");
    const { status, body } = run(err);
    expect(status).toBe(500);
    expect(body.message).toBe("Something went wrong on the server. Please try again in a moment.");
    expect(JSON.stringify(body)).not.toMatch(/secret|at |stack/);
  });

  it("non-Error throw -> 500", () => {
    expect(run("boom").status).toBe(500);
  });

  it("HttpException <500 keeps message", () => {
    const { status, body } = run(new ForbiddenException("You do not have permission to perform this action."));
    expect(status).toBe(403);
    expect(body.message).toBe("You do not have permission to perform this action.");
  });

  it("validation array passes through", () => {
    const { body } = run(new BadRequestException({ message: ["a must be set", "b invalid"] }));
    expect(body.message).toEqual(["a must be set", "b invalid"]);
  });

  it("404 without message gets friendly default", () => {
    const { body } = run(new HttpException({}, 404));
    expect(body.message).toBe("The requested item could not be found.");
    expect(run(new NotFoundException()).status).toBe(404);
  });

  it("HttpException >=500 message hidden", () => {
    const { status, body } = run(new HttpException("internal detail xyz", 503));
    expect(status).toBe(503);
    expect(body.message).toBe("Something went wrong on the server. Please try again in a moment.");
  });
});
