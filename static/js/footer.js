// Shows and hides the wechat qr code tooltips on mouseover.
document.addEventListener("DOMContentLoaded", function () {
  const showWechat = document.getElementById("showWechat");
  const imageContainer = document.getElementById("imageContainer");

  const showWechatOne = document.getElementById("showWechatOne");
  const imageContainerOne = document.getElementById("imageContainerOne");

  const showWechatTwo = document.getElementById("showWechatTwo");
  const imageContainerTwo = document.getElementById("imageContainerTwo");

  function showTooltip(element, container) {
    element.addEventListener("mouseover", () => {
      container.style.opacity = "1";
    });

    element.addEventListener("mouseout", () => {
      container.style.opacity = "0";
    });
  }

  showTooltip(showWechat, imageContainer);
  showTooltip(showWechatOne, imageContainerOne);
  showTooltip(showWechatTwo, imageContainerTwo);
});
