# tests/test_browser_compat.py
import pytest
from playwright.sync_api import Page, expect

BASE_URL      = "http://localhost:3000"
TEST_EMAIL    = "test@test.com"
TEST_PASSWORD = "test1234"

# Run with:
# pytest tests/test_browser_compat.py --browser chromium --browser firefox --browser webkit -v

@pytest.mark.parametrize("browser_name", ["chromium", "firefox", "webkit"])
class TestBrowserCompat:

    def test_login_renders(self, page: Page):
        """BC-01: Login page renders on all browsers."""
        page.goto(f"{BASE_URL}/login")
        expect(page.locator('input[type="email"]')).to_be_visible(timeout=8_000)
        expect(page.locator('input[type="password"]')).to_be_visible(timeout=8_000)
        expect(page.locator('button[type="submit"]')).to_be_visible(timeout=8_000)

    def test_login_flow(self, page: Page):
        """BC-02: Valid login redirects to home on all browsers."""
        page.goto(f"{BASE_URL}/login")
        page.fill('input[type="email"]',    TEST_EMAIL)
        page.fill('input[type="password"]', TEST_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_selector('[data-tour="navbar"]', timeout=15_000)

    def test_navbar_renders(self, page: Page):
        """BC-03: Navbar renders correctly on all browsers."""
        page.goto(f"{BASE_URL}/login")
        page.fill('input[type="email"]',    TEST_EMAIL)
        page.fill('input[type="password"]', TEST_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_selector('[data-tour="navbar"]', timeout=15_000)
        expect(page.locator('[data-tour="navbar"]')).to_be_visible()

    def test_course_page_loads(self, page: Page):
        """BC-04: /basic-java renders on all browsers."""
        # Navigate directly after login
        page.goto(f"{BASE_URL}/login")
        page.fill('input[type="email"]',    TEST_EMAIL)
        page.fill('input[type="password"]', TEST_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_selector('[data-tour="navbar"]', timeout=15_000)

        page.goto(f"{BASE_URL}/basic-java", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=15_000)
        content = page.locator("h1, h2, h3").first
        expect(content).to_be_visible(timeout=8_000)

    def test_playground_loads(self, page: Page):
        """BC-05: /playground renders editor on all browsers."""
        page.goto(f"{BASE_URL}/login")
        page.fill('input[type="email"]',    TEST_EMAIL)
        page.fill('input[type="password"]', TEST_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_selector('[data-tour="navbar"]', timeout=15_000)

        page.goto(f"{BASE_URL}/playground", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=12_000)
        expect(page.locator("textarea").first).to_be_visible(timeout=8_000)