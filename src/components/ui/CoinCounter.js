import React from "react";
import "../../styles/ui/CoinCounter.css";

const CoinCounter = ({ coins = 0 }) => {
  return (
    <div className="coin-counter">
      <span className="coin-icon">🪙</span>
      <span className="coin-count">{coins || 0}</span>
    </div>
  );
};

export default CoinCounter;
