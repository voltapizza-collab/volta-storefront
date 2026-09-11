import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import CatalogSwipeHint from "./CatalogSwipeHint";

beforeEach(() => { window.sessionStorage.clear(); jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test("waits for an eligible opening, expires after five seconds and stays dismissed for the session", () => {
  const { rerender, unmount } = render(<CatalogSwipeHint active={false} categoryId="promos" />);
  act(() => jest.advanceTimersByTime(6000));
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<CatalogSwipeHint active categoryId="promos" />);
  expect(screen.getByRole("status").textContent).toBe("Desliza para cambiar de categoría");
  act(() => jest.advanceTimersByTime(4999));
  expect(screen.getByRole("status")).not.toBeNull();
  act(() => jest.advanceTimersByTime(1));
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<CatalogSwipeHint active={false} categoryId="promos" />);
  rerender(<CatalogSwipeHint active categoryId="promos" />);
  expect(screen.queryByRole("status")).toBeNull();
  unmount();
  render(<CatalogSwipeHint active categoryId="pizza" />);
  expect(screen.queryByRole("status")).toBeNull();
});

test("changing category dismisses the guide immediately, including when returning to the original category", () => {
  const { rerender } = render(<CatalogSwipeHint active categoryId="promos" />);
  expect(screen.getByRole("status")).not.toBeNull();
  rerender(<CatalogSwipeHint active categoryId="pizza" />);
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<CatalogSwipeHint active categoryId="promos" />);
  expect(screen.queryByRole("status")).toBeNull();
});

test("opening search or a modal dismisses the guide without showing it again on return", () => {
  const { rerender } = render(<CatalogSwipeHint active categoryId="promos" />);
  rerender(<CatalogSwipeHint active={false} categoryId="promos" />);
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<CatalogSwipeHint active categoryId="promos" />);
  expect(screen.queryByRole("status")).toBeNull();
});

test("strict effects and unavailable storage still show a single timed guide", () => {
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  const { rerender } = render(<StrictMode><CatalogSwipeHint active categoryId="promos" /></StrictMode>);
  expect(screen.getByRole("status")).not.toBeNull();
  act(() => jest.advanceTimersByTime(5000));
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<StrictMode><CatalogSwipeHint active={false} categoryId="promos" /></StrictMode>);
  rerender(<StrictMode><CatalogSwipeHint active categoryId="promos" /></StrictMode>);
  expect(screen.queryByRole("status")).toBeNull();
});
