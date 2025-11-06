import React from "react";
import { Link } from "react-router-dom";

function Navbar() {
    return (
        <nav className="navbar bg-body-tertiary fixed-top">
            <div className="container-fluid d-flex align-items-center">
                {/* Left side: toggler button */}
                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="offcanvas"
                    data-bs-target="#offcanvasNavbar"
                    aria-controls="offcanvasNavbar"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>

                {/* Center: brand name */}
                <div className="mx-auto">
                    <Link className="navbar-brand mb-0 h1" to="/home">
                        My Java Learning Platform
                    </Link>
                </div>

                {/* Optional right side placeholder to keep center alignment symmetrical */}
                <div style={{ width: "40px" }}></div>

                {/* Offcanvas panel */}
                <div
                    className="offcanvas offcanvas-start"
                    tabIndex={-1}
                    id="offcanvasNavbar"
                    aria-labelledby="offcanvasNavbarLabel"
                >
                    <div className="offcanvas-header">
                        <h5 className="offcanvas-title" id="offcanvasNavbarLabel">
                            Java Learning Platform
                        </h5>
                        <button
                            type="button"
                            className="btn-close"
                            data-bs-dismiss="offcanvas"
                            aria-label="Close"
                        ></button>
                    </div>

                    <div className="offcanvas-body">
                        <ul className="navbar-nav justify-content-end flex-grow-1 pe-3">
                            <li className="nav-item">
                                <Link className="nav-link active" aria-current="page" to="/home">
                                    Home Page
                                </Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" to="/compiler">
                                    Compiler
                                </Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" to="/quiz">
                                    Quiz
                                </Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" to="/practical-test">
                                    Practical Test
                                </Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" to="/lessons">
                                    Lessons
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
